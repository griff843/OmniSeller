import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount } from '@omniseller/db';
import fetch from 'node-fetch';
import { EbayTokenService } from './ebay-token.service';
import {
  EbayImportResource,
  EbayImportSnapshot,
  ImportedEbayListing,
  ImportedEbayOrder,
} from './ebay-import.types';

type EbayImportCursor = {
  offset?: number;
  windowEnd?: string;
};

type EbayImportProviderOptions = {
  resources?: EbayImportResource[];
  cursors?: Partial<Record<EbayImportResource, string | null>>;
};

type EbayOffer = {
  offerId?: string;
  sku?: string;
  marketplaceId?: string;
  availableQuantity?: number;
  categoryId?: string;
  listingDescription?: string;
  status?: string;
  listing?: {
    listingId?: string;
    listingStatus?: string;
    soldQuantity?: number;
  };
  pricingSummary?: {
    price?: {
      value?: string;
    };
  };
};

type EbayInventoryItem = {
  product?: {
    title?: string;
    description?: string;
    aspects?: Record<string, string[]>;
  };
};

type EbayOrder = {
  orderId?: string;
  creationDate?: string;
  buyer?: {
    username?: string;
    buyerRegistrationAddress?: {
      fullName?: string;
      email?: string;
      primaryPhone?: {
        phoneNumber?: string;
      };
      contactAddress?: Record<string, unknown>;
    };
  };
  fulfillmentStartInstructions?: Array<{
    shippingStep?: {
      shipTo?: {
        fullName?: string;
        companyName?: string;
        contactAddress?: {
          addressLine1?: string;
          addressLine2?: string;
          city?: string;
          stateOrProvince?: string;
          postalCode?: string;
          countryCode?: string;
        };
      };
    };
  }>;
  pricingSummary?: {
    total?: { value?: string };
    deliveryCost?: { value?: string };
    tax?: { value?: string };
  };
  lineItems?: Array<{
    lineItemId?: string;
    legacyItemId?: string;
    title?: string;
    quantity?: number;
    lineItemCost?: { value?: string };
    total?: { value?: string };
    taxes?: Array<{ amount?: { value?: string } }>;
  }>;
};

@Injectable()
export class EbayImportProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly ebayTokenService: EbayTokenService,
  ) {}

  async fetchSnapshot(
    account: MarketplaceAccount,
    options: EbayImportProviderOptions = {},
  ): Promise<EbayImportSnapshot> {
    const resources = options.resources ?? ['LISTINGS', 'ORDERS'];
    const accessToken = await this.ebayTokenService.getValidAccessToken(account);
    const snapshot: EbayImportSnapshot = {
      cursors: {},
    };

    if (resources.includes('LISTINGS')) {
      const listingSnapshot = await this.fetchListings(accessToken, account, options.cursors?.LISTINGS ?? null);
      snapshot.listings = listingSnapshot.listings;
      snapshot.cursors = {
        ...snapshot.cursors,
        LISTINGS: listingSnapshot.cursor,
      };
    }

    if (resources.includes('ORDERS')) {
      const orderSnapshot = await this.fetchOrders(accessToken, options.cursors?.ORDERS ?? null);
      snapshot.orders = orderSnapshot.orders;
      snapshot.cursors = {
        ...snapshot.cursors,
        ORDERS: orderSnapshot.cursor,
      };
    }

    return snapshot;
  }

  private async fetchListings(
    accessToken: string,
    account: MarketplaceAccount,
    cursor: string | null,
  ): Promise<{ listings: ImportedEbayListing[]; cursor: string | null }> {
    const limit = this.getPageLimit('EBAY_IMPORT_LISTINGS_LIMIT', 100);
    const maxPages = this.getPageLimit('EBAY_IMPORT_MAX_PAGES', 5);
    let offset = this.parseCursor(cursor).offset ?? 0;
    let nextCursor: string | null = null;
    const listings: ImportedEbayListing[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const data = await this.fetchJson<{ offers?: EbayOffer[]; total?: number }>(
        accessToken,
        `/sell/inventory/v1/offer?${new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        })}`,
      );
      const offers = data.offers ?? [];
      const inventoryItems = await this.fetchInventoryItems(accessToken, offers);

      for (const offer of offers) {
        const listingId = offer.listing?.listingId;
        if (!listingId) {
          continue;
        }

        const listingStatus = this.mapListingStatus(offer.listing?.listingStatus ?? offer.status);
        if (listingStatus !== 'active') {
          continue;
        }

        const inventoryItem = offer.sku ? inventoryItems.get(offer.sku) : null;
        listings.push({
          marketplaceItemId: listingId,
          offerId: offer.offerId ?? null,
          listingUrl: this.buildListingUrl(account.siteId, listingId),
          title: inventoryItem?.product?.title ?? null,
          description: offer.listingDescription ?? inventoryItem?.product?.description ?? null,
          category: offer.categoryId ?? null,
          itemSpecifics: inventoryItem?.product?.aspects ?? null,
          priceCents: this.moneyToCents(offer.pricingSummary?.price?.value),
          quantity: offer.availableQuantity ?? 1,
          status: listingStatus,
        });
      }

      offset += limit;
      nextCursor =
        data.total !== undefined && offset < data.total ? JSON.stringify({ offset }) : null;

      if (!nextCursor || offers.length < limit) {
        break;
      }
    }

    return { listings, cursor: nextCursor };
  }

  private async fetchOrders(
    accessToken: string,
    cursor: string | null,
  ): Promise<{ orders: ImportedEbayOrder[]; cursor: string | null }> {
    const limit = this.getPageLimit('EBAY_IMPORT_ORDERS_LIMIT', 50);
    const maxPages = this.getPageLimit('EBAY_IMPORT_MAX_PAGES', 5);
    const parsedCursor = this.parseCursor(cursor);
    let offset = parsedCursor.offset ?? 0;
    const windowEnd = new Date();
    const windowStart = parsedCursor.windowEnd
      ? new Date(parsedCursor.windowEnd)
      : new Date(windowEnd.getTime() - this.getOrderWindowDays() * 24 * 60 * 60 * 1000);
    let nextCursor: string | null = null;
    const orders: ImportedEbayOrder[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const data = await this.fetchJson<{ orders?: EbayOrder[]; total?: number }>(
        accessToken,
        `/sell/fulfillment/v1/order?${new URLSearchParams({
          filter: `creationdate:[${windowStart.toISOString()}..${windowEnd.toISOString()}]`,
          limit: String(limit),
          offset: String(offset),
        })}`,
      );
      const pageOrders = data.orders ?? [];

      orders.push(...pageOrders.map((order) => this.mapOrder(order)).filter(Boolean));
      offset += limit;
      nextCursor =
        data.total !== undefined && offset < data.total
          ? JSON.stringify({ offset, windowEnd: windowEnd.toISOString() })
          : JSON.stringify({ offset: 0, windowEnd: windowEnd.toISOString() });

      if (pageOrders.length < limit || (data.total !== undefined && offset >= data.total)) {
        break;
      }
    }

    return { orders, cursor: nextCursor };
  }

  private async fetchInventoryItems(accessToken: string, offers: EbayOffer[]) {
    const items = new Map<string, EbayInventoryItem>();
    const skus = Array.from(new Set(offers.map((offer) => offer.sku).filter(Boolean))) as string[];

    await Promise.all(
      skus.map(async (sku) => {
        try {
          const item = await this.fetchJson<EbayInventoryItem>(
            accessToken,
            `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
          );
          items.set(sku, item);
        } catch {
          items.set(sku, {});
        }
      }),
    );

    return items;
  }

  private mapOrder(order: EbayOrder): ImportedEbayOrder | null {
    if (!order.orderId) {
      return null;
    }

    const registration = order.buyer?.buyerRegistrationAddress;
    const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
    const contactAddress = shipTo?.contactAddress;

    return {
      marketplaceOrderId: order.orderId,
      buyerName: registration?.fullName ?? order.buyer?.username ?? null,
      buyerEmail: registration?.email ?? null,
      buyerPhone: registration?.primaryPhone?.phoneNumber ?? null,
      buyerAddress: registration?.contactAddress ?? null,
      shippingName: shipTo?.fullName ?? null,
      shippingCompany: shipTo?.companyName ?? null,
      shippingAddress1: contactAddress?.addressLine1 ?? null,
      shippingAddress2: contactAddress?.addressLine2 ?? null,
      shippingCity: contactAddress?.city ?? null,
      shippingState: contactAddress?.stateOrProvince ?? null,
      shippingPostalCode: contactAddress?.postalCode ?? null,
      shippingCountry: contactAddress?.countryCode ?? null,
      totalCents: this.moneyToCents(order.pricingSummary?.total?.value),
      feeCents: 0,
      shippingCents: this.moneyToCents(order.pricingSummary?.deliveryCost?.value),
      taxCents: this.calculateTaxCents(order),
      createdAt: order.creationDate ?? null,
      items: (order.lineItems ?? [])
        .map((lineItem) => ({
          marketplaceLineItemId: lineItem.lineItemId ?? '',
          marketplaceItemId: lineItem.legacyItemId ?? null,
          title: lineItem.title ?? null,
          quantity: lineItem.quantity ?? 1,
          salePriceCents: this.moneyToCents(lineItem.total?.value ?? lineItem.lineItemCost?.value),
        }))
        .filter((lineItem) => lineItem.marketplaceLineItemId.length > 0),
    };
  }

  private calculateTaxCents(order: EbayOrder) {
    const pricingTax = this.moneyToCents(order.pricingSummary?.tax?.value);

    if (pricingTax > 0) {
      return pricingTax;
    }

    return (order.lineItems ?? []).reduce(
      (sum, lineItem) =>
        sum +
        (lineItem.taxes ?? []).reduce(
          (taxSum, tax) => taxSum + this.moneyToCents(tax.amount?.value),
          0,
        ),
      0,
    );
  }

  private async fetchJson<T>(accessToken: string, path: string): Promise<T> {
    const response = await fetch(`${this.getApiBase()}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`eBay import request failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as T;
  }

  private getApiBase() {
    if (this.configService.get<string>('EBAY_API_BASE')) {
      return this.configService.get<string>('EBAY_API_BASE') as string;
    }

    return this.configService.get<string>('EBAY_ENV') === 'SANDBOX'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }

  private parseCursor(cursor: string | null): EbayImportCursor {
    if (!cursor) {
      return {};
    }

    try {
      return JSON.parse(cursor) as EbayImportCursor;
    } catch {
      return {};
    }
  }

  private getPageLimit(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private getOrderWindowDays() {
    const value = Number(this.configService.get<string>('EBAY_IMPORT_ORDER_WINDOW_DAYS'));
    return Number.isFinite(value) && value > 0 ? value : 30;
  }

  private moneyToCents(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  }

  private mapListingStatus(status?: string | null): ImportedEbayListing['status'] {
    const normalized = status?.toUpperCase();

    if (normalized === 'ACTIVE' || normalized === 'PUBLISHED') {
      return 'active';
    }

    if (normalized === 'ENDED' || normalized === 'COMPLETED') {
      return 'ended';
    }

    return 'inactive';
  }

  private buildListingUrl(siteId: string | null, listingId: string) {
    if (siteId === 'EBAY-US' || siteId === 'EBAY_US' || !siteId) {
      return `https://www.ebay.com/itm/${listingId}`;
    }

    return `https://www.ebay.com/itm/${listingId}`;
  }
}
