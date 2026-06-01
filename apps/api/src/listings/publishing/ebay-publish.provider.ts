import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount } from '@omniseller/db';
import fetch from 'node-fetch';
import { EbayTokenService } from '../../ebay/ebay-token.service';
import {
  MarketplacePublishProvider,
  PublishAvailability,
  PublishDraftInput,
  PublishDraftResult,
} from './marketplace-publish.contract';

@Injectable()
export class EbayPublishProvider implements MarketplacePublishProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly ebayTokenService: EbayTokenService,
  ) {}

  getAvailability(marketplace: string, marketplaceAccount: MarketplaceAccount | null): PublishAvailability {
    if (marketplace !== 'ebay') {
      return {
        available: false,
        reason: `Marketplace ${marketplace} is not supported by the current publish provider.`,
      };
    }

    if (!marketplaceAccount) {
      return {
        available: false,
        reason: 'Connect an eBay marketplace account before publishing.',
      };
    }

    if (!marketplaceAccount.accessToken && !marketplaceAccount.refreshToken) {
      return {
        available: false,
        reason: 'eBay marketplace credentials are incomplete. Reconnect the marketplace account before publishing.',
      };
    }

    const missingConfig = this.getMissingPublishConfig(marketplaceAccount);
    if (missingConfig.length > 0) {
      return {
        available: false,
        reason: `Configure eBay publish settings before publishing: ${missingConfig.join(', ')}.`,
      };
    }

    return {
      available: true,
      marketplaceAccount: {
        id: marketplaceAccount.id,
        kind: marketplaceAccount.kind,
        siteId: marketplaceAccount.siteId,
        accessToken: marketplaceAccount.accessToken,
        refreshToken: marketplaceAccount.refreshToken,
        expiresAt: marketplaceAccount.expiresAt,
      },
    };
  }

  async publishDraft(input: PublishDraftInput): Promise<PublishDraftResult> {
    const account = input.marketplaceAccount as MarketplaceAccount;
    const accessToken = await this.ebayTokenService.getValidAccessToken(account);
    const existingListing = this.findExistingEbayListing(input.inventoryItem);
    const sku = this.buildSku(input.inventoryItem);
    const categoryId = this.getCategoryId(input.draft);

    await this.putInventoryItem(accessToken, sku, input);

    const offerPayload = this.buildOfferPayload(sku, categoryId, input);
    const offerId = existingListing?.offerId
      ? await this.updateOffer(accessToken, existingListing.offerId, offerPayload)
      : await this.createOffer(accessToken, offerPayload);

    if (existingListing?.marketplaceItemId && existingListing.offerId) {
      return {
        marketplaceItemId: existingListing.marketplaceItemId,
        offerId,
        listingUrl: existingListing.listingUrl ?? this.buildListingUrl(input.marketplaceAccount.siteId, existingListing.marketplaceItemId),
        status: 'active',
      };
    }

    const published = await this.publishOffer(accessToken, offerId);
    const marketplaceItemId = published.listingId ?? published.marketplaceItemId ?? existingListing?.marketplaceItemId;

    if (!marketplaceItemId) {
      throw new ServiceUnavailableException('eBay did not return a listing ID after publishing the offer.');
    }

    return {
      marketplaceItemId,
      offerId,
      listingUrl: this.buildListingUrl(input.marketplaceAccount.siteId, marketplaceItemId),
      status: 'active',
    };
  }

  private async putInventoryItem(accessToken: string, sku: string, input: PublishDraftInput) {
    await this.fetchJson(
      accessToken,
      `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
      {
        method: 'PUT',
        body: {
          availability: {
            shipToLocationAvailability: {
              quantity: this.getQuantity(input.inventoryItem),
            },
          },
          condition: this.mapCondition(input.inventoryItem.condition),
          product: {
            title: input.draft.title,
            description: input.draft.description,
            aspects: this.toEbayAspects(input.draft.itemSpecifics),
            imageUrls: this.getImageUrls(input.inventoryItem),
          },
        },
      },
    );
  }

  private async createOffer(accessToken: string, payload: Record<string, unknown>) {
    const data = await this.fetchJson<{ offerId?: string }>(accessToken, '/sell/inventory/v1/offer', {
      method: 'POST',
      body: payload,
    });

    if (!data.offerId) {
      throw new ServiceUnavailableException('eBay did not return an offer ID after creating the offer.');
    }

    return data.offerId;
  }

  private async updateOffer(accessToken: string, offerId: string, payload: Record<string, unknown>) {
    const data = await this.fetchJson<{ offerId?: string }>(
      accessToken,
      `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
      {
        method: 'PUT',
        body: payload,
      },
    );

    return data.offerId ?? offerId;
  }

  private async publishOffer(accessToken: string, offerId: string) {
    return this.fetchJson<{ listingId?: string; marketplaceItemId?: string }>(
      accessToken,
      `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
      {
        method: 'POST',
      },
    );
  }

  private buildOfferPayload(sku: string, categoryId: string, input: PublishDraftInput) {
    return {
      sku,
      marketplaceId: this.getMarketplaceId(input.marketplaceAccount.siteId),
      format: 'FIXED_PRICE',
      availableQuantity: this.getQuantity(input.inventoryItem),
      categoryId,
      listingDescription: input.draft.description,
      listingPolicies: {
        paymentPolicyId: this.requiredConfig('EBAY_PAYMENT_POLICY_ID'),
        fulfillmentPolicyId: this.requiredConfig('EBAY_FULFILLMENT_POLICY_ID'),
        returnPolicyId: this.requiredConfig('EBAY_RETURN_POLICY_ID'),
      },
      merchantLocationKey: this.requiredConfig('EBAY_MERCHANT_LOCATION_KEY'),
      pricingSummary: {
        price: {
          currency: this.configService.get<string>('EBAY_CURRENCY') ?? 'USD',
          value: (Number(input.draft.priceCents) / 100).toFixed(2),
        },
      },
    };
  }

  private async fetchJson<T>(
    accessToken: string,
    path: string,
    options: { method: 'GET' | 'POST' | 'PUT'; body?: unknown },
  ): Promise<T> {
    const response = await fetch(`${this.getApiBase()}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Language': this.configService.get<string>('EBAY_CONTENT_LANGUAGE') ?? 'en-US',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return {} as T;
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(`eBay publish request failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as T;
  }

  private findExistingEbayListing(item: any) {
    return (item.listings ?? []).find((listing: any) => listing.marketplace === 'ebay') ?? null;
  }

  private buildSku(item: any) {
    const sku = typeof item.sku === 'string' && item.sku.trim().length > 0 ? item.sku.trim() : item.id;
    return sku.replace(/\s+/g, '-').slice(0, 50);
  }

  private getCategoryId(draft: any) {
    const resolvedCategoryId = draft?.metadata?.ebay?.categoryId;

    if (typeof resolvedCategoryId === 'string' && /^\d+$/.test(resolvedCategoryId.trim())) {
      return resolvedCategoryId.trim();
    }

    const category = typeof draft?.category === 'string' ? draft.category.trim() : '';

    if (/^\d+$/.test(category)) {
      return category;
    }

    return this.requiredConfig('EBAY_DEFAULT_CATEGORY_ID');
  }

  private getQuantity(item: any) {
    return Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  }

  private getImageUrls(item: any) {
    return (item.photos ?? [])
      .filter((photo: any) => photo.uploadStatus === 'READY' && typeof photo.url === 'string' && photo.url.length > 0)
      .sort((left: any, right: any) => (left.sort ?? 0) - (right.sort ?? 0))
      .map((photo: any) => photo.url);
  }

  private toEbayAspects(itemSpecifics: unknown) {
    if (!itemSpecifics || typeof itemSpecifics !== 'object' || Array.isArray(itemSpecifics)) {
      return {};
    }

    return Object.entries(itemSpecifics as Record<string, unknown>).reduce<Record<string, string[]>>(
      (aspects, [key, value]) => {
        const values = Array.isArray(value) ? value : [value];
        const normalized = values
          .filter((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0)
          .map((entry) => String(entry).trim());

        if (normalized.length > 0) {
          aspects[key] = normalized;
        }

        return aspects;
      },
      {},
    );
  }

  private mapCondition(condition?: string | null) {
    const normalized = condition?.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

    if (normalized === 'NEW' || normalized === 'NEW_WITH_TAGS') {
      return 'NEW';
    }

    if (normalized === 'LIKE_NEW' || normalized === 'OPEN_BOX') {
      return 'USED_EXCELLENT';
    }

    if (normalized === 'FOR_PARTS' || normalized === 'PARTS') {
      return 'FOR_PARTS_OR_NOT_WORKING';
    }

    return 'USED';
  }

  private getMissingPublishConfig(account: MarketplaceAccount) {
    const missing = [
      'EBAY_MERCHANT_LOCATION_KEY',
      'EBAY_PAYMENT_POLICY_ID',
      'EBAY_FULFILLMENT_POLICY_ID',
      'EBAY_RETURN_POLICY_ID',
    ].filter((key) => !this.configService.get<string>(key));

    if (!this.getMarketplaceId(account.siteId)) {
      missing.push('EBAY_MARKETPLACE_ID');
    }

    return missing;
  }

  private getMarketplaceId(siteId?: string | null) {
    return this.configService.get<string>('EBAY_MARKETPLACE_ID') ?? siteId?.replace('-', '_') ?? 'EBAY_US';
  }

  private requiredConfig(key: string) {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new ServiceUnavailableException(`Missing required eBay publish setting ${key}.`);
    }

    return value;
  }

  private getApiBase() {
    if (this.configService.get<string>('EBAY_API_BASE')) {
      return this.configService.get<string>('EBAY_API_BASE') as string;
    }

    return this.configService.get<string>('EBAY_ENV') === 'SANDBOX'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }

  private buildListingUrl(siteId: string | null | undefined, listingId: string) {
    const hostBySiteId: Record<string, string> = {
      EBAY_AU: 'www.ebay.com.au',
      EBAY_CA: 'www.ebay.ca',
      EBAY_DE: 'www.ebay.de',
      EBAY_ES: 'www.ebay.es',
      EBAY_FR: 'www.ebay.fr',
      EBAY_GB: 'www.ebay.co.uk',
      EBAY_IT: 'www.ebay.it',
      EBAY_US: 'www.ebay.com',
    };
    const normalizedSiteId = siteId?.replace('-', '_').toUpperCase() ?? 'EBAY_US';
    const host = hostBySiteId[normalizedSiteId] ?? 'www.ebay.com';

    return `https://${host}/itm/${listingId}`;
  }
}
