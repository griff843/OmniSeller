import { BadGatewayException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, prisma } from '@omniseller/db';
import fetch from 'node-fetch';
import { decryptProviderToken, encryptProviderToken } from '../common/provider-token-vault';
import { resolveUserId } from '../common/user-context';

type EbayMoney = { value?: string; currency?: string };
type EbayLineItem = { lineItemId?: string; legacyItemId?: string; sku?: string; quantity?: number; lineItemCost?: EbayMoney };
type EbayOrder = {
  orderId?: string;
  creationDate?: string;
  lastModifiedDate?: string;
  orderFulfillmentStatus?: string;
  cancelStatus?: { cancelState?: string };
  pricingSummary?: { total?: EbayMoney; deliveryCost?: EbayMoney; tax?: EbayMoney; marketplaceFee?: EbayMoney };
  buyer?: { username?: string; buyerRegistrationAddress?: { fullName?: string; contactAddress?: EbayAddress; primaryPhone?: { phoneNumber?: string }; email?: string } };
  fulfillmentStartInstructions?: Array<{ shippingStep?: { shipTo?: EbayAddress & { fullName?: string; companyName?: string; primaryPhone?: { phoneNumber?: string }; email?: string } } }>;
  lineItems?: EbayLineItem[];
};
type EbayAddress = { addressLine1?: string; addressLine2?: string; city?: string; stateOrProvince?: string; postalCode?: string; countryCode?: string };

function cents(money?: EbayMoney): number {
  const value = Number.parseFloat(money?.value ?? '0');
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function isCancelledEbayOrder(order: EbayOrder): boolean {
  const cancel = order.cancelStatus?.cancelState?.toUpperCase();
  return Boolean(cancel && !['NONE_REQUESTED', 'CANCEL_REJECTED'].includes(cancel));
}

@Injectable()
export class EbayOrderSyncService {
  private readonly logger = new Logger(EbayOrderSyncService.name);
  constructor(private readonly config: ConfigService) {}

  async syncForUser(userId?: string) {
    const ownerId = resolveUserId(userId);
    const account = await prisma.marketplaceAccount.findFirst({ where: { userId: ownerId, kind: 'ebay' }, orderBy: { updatedAt: 'desc' } });
    if (!account) throw new NotFoundException('Connect an eBay account before synchronizing orders.');
    return this.syncAccount(account.id);
  }

  async syncAllConnectedAccounts() {
    const accounts = await prisma.marketplaceAccount.findMany({ where: { kind: 'ebay', refreshToken: { not: null } }, select: { id: true } });
    const results = [];
    for (const account of accounts) {
      try { results.push(await this.syncAccount(account.id)); }
      catch (error) { this.logger.error(`eBay order sync failed for account ${account.id}: ${error instanceof Error ? error.message : 'unknown error'}`); }
    }
    return results;
  }

  async syncAccount(accountId: string) {
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Marketplace account not found.');
    const token = await this.getValidAccessToken(account);
    if (!token) {
      await prisma.marketplaceAccount.update({ where: { id: account.id }, data: { syncStatus: 'UNAVAILABLE', lastSyncError: 'Reconnect eBay before synchronizing orders.' } });
      throw new ServiceUnavailableException('Reconnect eBay before synchronizing orders.');
    }

    const startedAt = new Date();
    const from = account.syncCursor ? new Date(account.syncCursor) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const overlapFrom = new Date(from.getTime() - 5 * 60 * 1000);
    try {
      await prisma.marketplaceAccount.update({ where: { id: account.id }, data: { syncStatus: 'PROCESSING', lastSyncError: null } });
      const orders = await this.fetchOrders(token, overlapFrom, startedAt);
      let upserted = 0;
      for (const order of orders) {
        if (!order.orderId) continue;
        await this.reconcileOrder(account.id, order);
        upserted += 1;
      }
      await prisma.marketplaceAccount.update({ where: { id: account.id }, data: { syncStatus: 'READY', syncCursor: startedAt.toISOString(), lastSyncAt: new Date(), lastSyncError: null } });
      return { accountId: account.id, fetched: orders.length, upserted, checkpoint: startedAt.toISOString(), status: 'READY' };
    } catch (error) {
      const safe = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown eBay synchronization failure';
      await prisma.marketplaceAccount.update({ where: { id: account.id }, data: { syncStatus: 'FAILED', lastSyncError: safe } });
      throw error;
    }
  }

  private async getValidAccessToken(account: { id: string; accessToken: string | null; refreshToken: string | null; expiresAt: Date | null }) {
    const access = decryptProviderToken(account.accessToken);
    if (access && account.expiresAt && account.expiresAt.getTime() > Date.now() + 60_000) return access;
    const refresh = decryptProviderToken(account.refreshToken);
    const clientId = this.config.get<string>('EBAY_CLIENT_ID');
    const clientSecret = this.config.get<string>('EBAY_CLIENT_SECRET');
    if (!refresh || !clientId || !clientSecret) return access;
    const base = (this.config.get<string>('EBAY_API_BASE') ?? 'https://api.ebay.com').replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${base}/identity/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment' }), signal: controller.signal as any });
      if (!response.ok) throw new ServiceUnavailableException(`eBay token refresh returned ${response.status}.`);
      const payload = await response.json() as { access_token?: string; expires_in?: number };
      if (!payload.access_token) throw new ServiceUnavailableException('eBay token refresh returned no access token.');
      const encrypted = encryptProviderToken(payload.access_token);
      await prisma.marketplaceAccount.update({ where: { id: account.id }, data: { accessToken: encrypted.value, tokenKeyId: encrypted.keyId, expiresAt: new Date(Date.now() + (payload.expires_in ?? 7200) * 1000) } });
      return payload.access_token;
    } finally { clearTimeout(timeout); }
  }

  private async fetchOrders(token: string, from: Date, to: Date): Promise<EbayOrder[]> {
    const base = (this.config.get<string>('EBAY_API_BASE') ?? 'https://api.ebay.com').replace(/\/$/, '');
    const orders: EbayOrder[] = [];
    for (let offset = 0; offset < 1000; offset += 50) {
      const filter = `lastmodifieddate:[${from.toISOString()}..${to.toISOString()}]`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(`${base}/sell/fulfillment/v1/order?limit=50&offset=${offset}&filter=${encodeURIComponent(filter)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal as any,
        });
        if (!response.ok) throw new BadGatewayException(`eBay order synchronization returned ${response.status}.`);
        const payload = await response.json() as { orders?: EbayOrder[]; total?: number };
        const page = payload.orders ?? [];
        orders.push(...page);
        if (page.length < 50 || orders.length >= (payload.total ?? orders.length)) break;
      } catch (error) {
        if (error instanceof BadGatewayException) throw error;
        throw new BadGatewayException(error instanceof Error && error.name === 'AbortError' ? 'eBay order synchronization timed out.' : 'eBay order synchronization failed over the network.');
      } finally { clearTimeout(timeout); }
    }
    return orders;
  }

  private async reconcileOrder(accountId: string, order: EbayOrder) {
    const orderId = order.orderId!;
    const cancelled = isCancelledEbayOrder(order);
    const shipping = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
    const buyer = order.buyer?.buyerRegistrationAddress;
    await prisma.$transaction(async (tx) => {
      const persisted = await tx.order.upsert({
        where: { marketplaceOrderId: orderId },
        create: {
          marketplace: 'ebay', marketplaceOrderId: orderId, marketplaceAccountId: accountId,
          buyerName: buyer?.fullName ?? order.buyer?.username ?? null, buyerPhone: buyer?.primaryPhone?.phoneNumber ?? null, buyerEmail: buyer?.email ?? null,
          shippingName: shipping?.fullName ?? null, shippingCompany: shipping?.companyName ?? null,
          shippingAddress1: shipping?.addressLine1 ?? null, shippingAddress2: shipping?.addressLine2 ?? null,
          shippingCity: shipping?.city ?? null, shippingState: shipping?.stateOrProvince ?? null,
          shippingPostalCode: shipping?.postalCode ?? null, shippingCountry: shipping?.countryCode ?? null,
          totalCents: cents(order.pricingSummary?.total), shippingCents: cents(order.pricingSummary?.deliveryCost), taxCents: cents(order.pricingSummary?.tax), feeCents: cents(order.pricingSummary?.marketplaceFee),
          status: cancelled ? 'CANCELLED' : order.orderFulfillmentStatus ?? 'ACTIVE', providerCreatedAt: order.creationDate ? new Date(order.creationDate) : null, providerUpdatedAt: order.lastModifiedDate ? new Date(order.lastModifiedDate) : null,
          rawDiagnostics: { provider: 'ebay', orderId, receivedAt: new Date().toISOString(), lineItemCount: order.lineItems?.length ?? 0 } as Prisma.JsonObject,
        },
        update: {
          status: cancelled ? 'CANCELLED' : order.orderFulfillmentStatus ?? 'ACTIVE', providerUpdatedAt: order.lastModifiedDate ? new Date(order.lastModifiedDate) : null,
          totalCents: cents(order.pricingSummary?.total), rawDiagnostics: { provider: 'ebay', orderId, receivedAt: new Date().toISOString(), lineItemCount: order.lineItems?.length ?? 0 } as Prisma.JsonObject,
        },
      });

      for (const line of order.lineItems ?? []) {
        if (!line.lineItemId) continue;
        const listing = await tx.listing.findFirst({ where: { marketplaceAccountId: accountId, OR: [{ marketplaceItemId: line.legacyItemId }, { inventoryItem: { sku: line.sku ?? '__never__' } }] } });
        await tx.orderItem.upsert({
          where: { orderId_marketplaceLineItemId: { orderId: persisted.id, marketplaceLineItemId: line.lineItemId } },
          create: { orderId: persisted.id, marketplaceLineItemId: line.lineItemId, listingId: listing?.id ?? null, inventoryItemId: listing?.inventoryItemId ?? null, quantity: line.quantity ?? 1, salePriceCents: cents(line.lineItemCost) },
          update: { listingId: listing?.id ?? null, inventoryItemId: listing?.inventoryItemId ?? null, quantity: line.quantity ?? 1, salePriceCents: cents(line.lineItemCost) },
        });
        if (listing?.inventoryItemId) {
          await tx.inventoryItem.update({ where: { id: listing.inventoryItemId }, data: cancelled ? { saleStatus: 'LISTED' } : { saleStatus: 'SOLD' } });
          await tx.listing.update({ where: { id: listing.id }, data: { status: cancelled ? 'active' : 'sold' } });
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
