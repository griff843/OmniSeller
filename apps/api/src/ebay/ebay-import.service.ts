import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount, prisma } from '@omniseller/db';
import { resolveUserId } from '../common/user-context';
import { EbayImportProvider } from './ebay-import.provider';
import {
  EbayImportResource,
  EbayImportResult,
  EbayImportSnapshot,
  ImportedEbayListing,
  ImportedEbayOrder,
  ImportedEbayOrderItem,
} from './ebay-import.types';

const RESOURCE_LIST: EbayImportResource[] = ['LISTINGS', 'ORDERS'];
const TERMINAL_SALE_STATES = new Set(['RESERVED', 'SOLD', 'SHIPPED']);

@Injectable()
export class EbayImportService {
  constructor(
    private readonly importProvider: EbayImportProvider,
    private readonly configService?: ConfigService,
  ) {}

  async sync(resource: EbayImportResource | 'ALL' = 'ALL', userId?: string) {
    const ownerId = resolveUserId(userId);
    const account = await this.findLatestEbayAccount(ownerId);

    if (!account) {
      throw new NotFoundException('Connect an eBay account before importing marketplace activity.');
    }

    return this.performSync(account, resource);
  }

  async syncAccount(marketplaceAccountId: string, resource: EbayImportResource | 'ALL' = 'ALL') {
    const account = await prisma.marketplaceAccount.findFirst({
      where: {
        id: marketplaceAccountId,
        kind: 'ebay',
      },
    });

    if (!account) {
      throw new NotFoundException(`eBay marketplace account ${marketplaceAccountId} was not found.`);
    }

    return this.performSync(account, resource);
  }

  async syncAllConnectedAccounts() {
    const accounts = await prisma.marketplaceAccount.findMany({
      where: {
        kind: 'ebay',
        refreshToken: {
          not: null,
        },
      },
      orderBy: { updatedAt: 'asc' },
    } as any);
    const results = [];

    for (const account of accounts) {
      try {
        results.push(await this.performSync(account, 'ALL'));
      } catch (error) {
        results.push({
          accountId: account.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      accountCount: accounts.length,
      results,
    };
  }

  private async performSync(account: MarketplaceAccount, resource: EbayImportResource | 'ALL') {
    if (resource !== 'ALL' && !RESOURCE_LIST.includes(resource)) {
      throw new BadRequestException('Sync resource must be LISTINGS, ORDERS, or ALL.');
    }

    const resources = resource === 'ALL' ? RESOURCE_LIST : [resource];
    const cursors = await this.getExistingCursors(account.id, resources);
    const snapshot = await this.importProvider.fetchSnapshot(account, { resources, cursors });
    const results: EbayImportResult[] = [];

    for (const syncResource of resources) {
      await this.markSyncStarted(account.id, syncResource);

      try {
        const result =
          syncResource === 'LISTINGS'
            ? await this.importListings(account, snapshot.listings ?? [], snapshot.cursors?.LISTINGS ?? null)
            : await this.importOrders(account, snapshot.orders ?? [], snapshot.cursors?.ORDERS ?? null);

        results.push(result);
      } catch (error) {
        await this.markSyncFailed(account.id, syncResource, error);
        throw error;
      }
    }

    return {
      accountId: account.id,
      resources: results,
    };
  }

  async getStatus(userId?: string) {
    const ownerId = resolveUserId(userId);
    const account = await this.findLatestEbayAccount(ownerId);

    if (!account) {
      return {
        connected: false,
        accountId: null,
        states: [],
      };
    }

    const states = await prisma.marketplaceSyncState.findMany({
      where: {
        marketplaceAccountId: account.id,
      },
      orderBy: { resource: 'asc' },
    } as any);

    return {
      connected: true,
      accountId: account.id,
      schedule: this.getScheduleStatus(),
      states: states.map((state: any) => ({
        resource: state.resource,
        status: state.status,
        cursor: state.cursor ?? null,
        lastStartedAt: state.lastStartedAt ?? null,
        lastFinishedAt: state.lastFinishedAt ?? null,
        lastSyncedAt: state.lastSyncedAt ?? null,
        lastError: state.lastError ?? null,
      })),
    };
  }

  getScheduleStatus() {
    const enabled = this.configService?.get<string>('EBAY_SYNC_SCHEDULE_ENABLED') !== 'false';
    const configuredInterval = Number(this.configService?.get<string>('EBAY_SYNC_INTERVAL_MINUTES'));

    return {
      enabled,
      intervalMinutes: Number.isFinite(configuredInterval) && configuredInterval > 0 ? configuredInterval : 30,
    };
  }

  async importSnapshot(account: MarketplaceAccount, snapshot: EbayImportSnapshot) {
    const results: EbayImportResult[] = [];

    if (snapshot.listings) {
      results.push(await this.importListings(account, snapshot.listings, snapshot.cursors?.LISTINGS ?? null));
    }

    if (snapshot.orders) {
      results.push(await this.importOrders(account, snapshot.orders, snapshot.cursors?.ORDERS ?? null));
    }

    return results;
  }

  private async importListings(account: MarketplaceAccount, listings: ImportedEbayListing[], cursor: string | null) {
    let created = 0;
    let updated = 0;

    for (const imported of listings) {
      const existingListing: any = await prisma.listing.findFirst({
        where: {
          marketplaceAccountId: account.id,
          marketplaceItemId: imported.marketplaceItemId,
        },
        include: { inventoryItem: true },
      } as any);
      const inventoryItem =
        existingListing?.inventoryItem ?? (await this.createPlaceholderInventoryItem(account, imported));
      const listingData = this.toListingData(imported, inventoryItem.id, account.id);

      const listing = await prisma.listing.upsert({
        where: {
          marketplaceAccountId_marketplaceItemId: {
            marketplaceAccountId: account.id,
            marketplaceItemId: imported.marketplaceItemId,
          },
        },
        create: listingData,
        update: listingData,
      } as any);

      if (existingListing) {
        updated += 1;
      } else {
        created += 1;
      }

      await this.applyListingLifecycle(inventoryItem, imported, listing.id);
    }

    return this.markSyncCompleted(account.id, 'LISTINGS', listings.length, created, updated, cursor);
  }

  private async importOrders(account: MarketplaceAccount, orders: ImportedEbayOrder[], cursor: string | null) {
    let created = 0;
    let updated = 0;

    for (const imported of orders) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          marketplaceOrderId: imported.marketplaceOrderId,
          marketplaceAccountId: account.id,
        },
      } as any);
      const orderData = this.toOrderData(imported, account.id);
      const order = await prisma.order.upsert({
        where: {
          marketplaceAccountId_marketplaceOrderId: {
            marketplaceAccountId: account.id,
            marketplaceOrderId: imported.marketplaceOrderId,
          },
        },
        create: orderData,
        update: orderData,
      } as any);

      existingOrder ? (updated += 1) : (created += 1);

      for (const item of imported.items) {
        await this.upsertOrderItem(account, order.id, item);
      }
    }

    return this.markSyncCompleted(account.id, 'ORDERS', orders.length, created, updated, cursor);
  }

  private async upsertOrderItem(account: MarketplaceAccount, orderId: string, item: ImportedEbayOrderItem) {
    const listing = item.marketplaceItemId
      ? await prisma.listing.findFirst({
          where: {
            marketplaceAccountId: account.id,
            marketplaceItemId: item.marketplaceItemId,
          },
          include: { inventoryItem: true },
        } as any)
      : null;
    const data = {
      orderId,
      listingId: listing?.id ?? null,
      inventoryItemId: listing?.inventoryItemId ?? null,
      marketplaceLineItemId: item.marketplaceLineItemId,
      quantity: item.quantity ?? 1,
      salePriceCents: item.salePriceCents,
    };
    await prisma.orderItem.upsert({
      where: {
        orderId_marketplaceLineItemId: {
          orderId,
          marketplaceLineItemId: item.marketplaceLineItemId,
        },
      },
      create: data,
      update: data,
    } as any);

    if (listing?.inventoryItemId) {
      await prisma.inventoryItem.update({
        where: { id: listing.inventoryItemId },
        data: {
          saleStatus: 'SOLD',
          publishStatus: 'PUBLISHED',
          publishMarketplace: 'ebay',
        },
      } as any);
      await prisma.listing.update({
        where: { id: listing.id },
        data: { status: 'sold' },
      } as any);
    }
  }

  private async createPlaceholderInventoryItem(account: MarketplaceAccount, listing: ImportedEbayListing) {
    return prisma.inventoryItem.create({
      data: {
        userId: account.userId,
        sku: this.buildImportedSku(account.id, listing.marketplaceItemId),
        title: listing.title ?? `Imported eBay item ${listing.marketplaceItemId}`,
        description: listing.description ?? null,
        category: listing.category ?? null,
        inventoryStatus: 'IN_STOCK',
        listingReadiness: listing.status === 'active' ? 'LISTED' : 'READY_FOR_LISTING',
        saleStatus: listing.status === 'sold' ? 'SOLD' : listing.status === 'active' ? 'LISTED' : 'AVAILABLE',
        publishStatus: listing.status === 'active' || listing.status === 'sold' ? 'PUBLISHED' : 'NOT_REQUESTED',
        publishMarketplace: 'ebay',
        publishedAt: listing.publishedAt ? new Date(listing.publishedAt) : null,
      },
    } as any);
  }

  private async applyListingLifecycle(inventoryItem: any, listing: ImportedEbayListing, listingId: string) {
    const listed = listing.status === 'active';
    const sold = listing.status === 'sold';

    if (!listed && !sold) {
      await prisma.listing.update({
        where: { id: listingId },
        data: { status: listing.status },
      } as any);
      return;
    }

    if (TERMINAL_SALE_STATES.has(inventoryItem.saleStatus)) {
      return;
    }

    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        listingReadiness: 'LISTED',
        saleStatus: sold ? 'SOLD' : 'LISTED',
        publishStatus: 'PUBLISHED',
        publishMarketplace: 'ebay',
        publishedAt: listing.publishedAt ? new Date(listing.publishedAt) : undefined,
      },
    } as any);
  }

  private toListingData(listing: ImportedEbayListing, inventoryItemId: string, marketplaceAccountId: string) {
    return {
      inventoryItemId,
      marketplaceAccountId,
      marketplace: 'ebay',
      marketplaceItemId: listing.marketplaceItemId,
      offerId: listing.offerId ?? null,
      listingUrl: listing.listingUrl ?? null,
      title: listing.title ?? null,
      description: listing.description ?? null,
      category: listing.category ?? null,
      itemSpecifics: listing.itemSpecifics ?? undefined,
      priceCents: listing.priceCents,
      quantity: listing.quantity ?? 1,
      status: listing.status,
    };
  }

  private toOrderData(order: ImportedEbayOrder, marketplaceAccountId: string) {
    return {
      marketplace: 'ebay',
      marketplaceOrderId: order.marketplaceOrderId,
      marketplaceAccountId,
      buyerName: order.buyerName ?? null,
      buyerAddress: order.buyerAddress ?? undefined,
      buyerPhone: order.buyerPhone ?? null,
      buyerEmail: order.buyerEmail ?? null,
      shippingName: order.shippingName ?? null,
      shippingCompany: order.shippingCompany ?? null,
      shippingAddress1: order.shippingAddress1 ?? null,
      shippingAddress2: order.shippingAddress2 ?? null,
      shippingCity: order.shippingCity ?? null,
      shippingState: order.shippingState ?? null,
      shippingPostalCode: order.shippingPostalCode ?? null,
      shippingCountry: order.shippingCountry ?? null,
      totalCents: order.totalCents,
      feeCents: order.feeCents ?? 0,
      shippingCents: order.shippingCents ?? 0,
      taxCents: order.taxCents ?? 0,
      createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
    };
  }

  private markSyncStarted(accountId: string, resource: EbayImportResource) {
    return prisma.marketplaceSyncState.upsert({
      where: {
        marketplaceAccountId_resource: {
          marketplaceAccountId: accountId,
          resource,
        },
      },
      create: {
        marketplaceAccountId: accountId,
        resource,
        status: 'RUNNING',
        lastStartedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'RUNNING',
        lastStartedAt: new Date(),
        lastError: null,
      },
    } as any);
  }

  private async markSyncCompleted(
    accountId: string,
    resource: EbayImportResource,
    imported: number,
    created: number,
    updated: number,
    cursor: string | null,
  ): Promise<EbayImportResult> {
    const completedAt = new Date();

    await prisma.marketplaceSyncState.upsert({
      where: {
        marketplaceAccountId_resource: {
          marketplaceAccountId: accountId,
          resource,
        },
      },
      create: {
        marketplaceAccountId: accountId,
        resource,
        status: 'COMPLETED',
        cursor,
        lastFinishedAt: completedAt,
        lastSyncedAt: completedAt,
      },
      update: {
        status: 'COMPLETED',
        cursor,
        lastFinishedAt: completedAt,
        lastSyncedAt: completedAt,
        lastError: null,
      },
    } as any);

    return {
      resource,
      imported,
      created,
      updated,
      cursor,
      lastSyncedAt: completedAt,
    };
  }

  private markSyncFailed(accountId: string, resource: EbayImportResource, error: unknown) {
    return prisma.marketplaceSyncState.upsert({
      where: {
        marketplaceAccountId_resource: {
          marketplaceAccountId: accountId,
          resource,
        },
      },
      create: {
        marketplaceAccountId: accountId,
        resource,
        status: 'FAILED',
        lastFinishedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      },
      update: {
        status: 'FAILED',
        lastFinishedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      },
    } as any);
  }

  private async findLatestEbayAccount(userId: string) {
    return prisma.marketplaceAccount.findFirst({
      where: {
        userId,
        kind: 'ebay',
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async getExistingCursors(accountId: string, resources: EbayImportResource[]) {
    const states = await prisma.marketplaceSyncState.findMany({
      where: {
        marketplaceAccountId: accountId,
        resource: {
          in: resources,
        },
      },
    } as any);

    return states.reduce(
      (cursors: Partial<Record<EbayImportResource, string | null>>, state: any) => ({
        ...cursors,
        [state.resource]: state.cursor ?? null,
      }),
      {},
    );
  }

  private buildImportedSku(accountId: string, marketplaceItemId: string) {
    const sanitizedAccount = accountId.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10);
    const sanitizedItem = marketplaceItemId.replace(/[^a-z0-9]/gi, '').toUpperCase();

    return `EBAY-${sanitizedAccount}-${sanitizedItem}`;
  }
}
