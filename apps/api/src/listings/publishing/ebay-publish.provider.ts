import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch, { RequestInit, Response } from 'node-fetch';
import {
  MarketplacePublishProvider,
  PublishAvailability,
  PublishDraftInput,
  PublishDraftResult,
} from './marketplace-publish.contract';

const REQUIRED_PUBLISH_SETTINGS = [
  'EBAY_MERCHANT_LOCATION_KEY',
  'EBAY_PAYMENT_POLICY_ID',
  'EBAY_RETURN_POLICY_ID',
  'EBAY_FULFILLMENT_POLICY_ID',
] as const;

@Injectable()
export class EbayPublishProvider implements MarketplacePublishProvider {
  constructor(private readonly configService: ConfigService) {}

  getAvailability(marketplace: string, marketplaceAccount: any | null): PublishAvailability {
    if (marketplace.toLowerCase() !== 'ebay') {
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

    if (!marketplaceAccount.accessToken) {
      return {
        available: false,
        reason: 'The eBay access token is missing. Reconnect the marketplace account before publishing.',
      };
    }

    const missingSettings = REQUIRED_PUBLISH_SETTINGS.filter((name) => !this.configService.get<string>(name));
    if (missingSettings.length > 0) {
      return {
        available: false,
        reason: `eBay publishing configuration is incomplete. Set ${missingSettings.join(', ')}.`,
      };
    }

    return {
      available: true,
      marketplaceAccount: {
        id: marketplaceAccount.id,
        kind: marketplaceAccount.kind,
        accessToken: marketplaceAccount.accessToken,
        refreshToken: marketplaceAccount.refreshToken,
      },
    };
  }

  async publishDraft(input: PublishDraftInput): Promise<PublishDraftResult> {
    const accessToken = input.marketplaceAccount.accessToken;
    if (!accessToken) {
      throw new BadRequestException('The connected eBay account has no access token.');
    }

    const sku = String(input.inventoryItem.sku ?? '').trim();
    const categoryId = String(input.draft.category ?? '').trim();
    const imageUrls = (input.inventoryItem.photos ?? [])
      .filter((photo: any) => photo.uploadStatus === 'READY' && typeof photo.url === 'string')
      .sort((left: any, right: any) => Number(right.isPrimary) - Number(left.isPrimary) || left.sort - right.sort)
      .map((photo: any) => photo.url);

    if (!sku || !/^\d+$/.test(categoryId)) {
      throw new BadRequestException('eBay publishing requires a SKU and a numeric eBay category ID.');
    }

    if (imageUrls.length === 0 || imageUrls.some((url: string) => !/^https:\/\//i.test(url))) {
      throw new BadRequestException('eBay publishing requires at least one publicly reachable HTTPS photo URL.');
    }

    const marketplaceId = this.configService.get<string>('EBAY_MARKETPLACE_ID') ?? 'EBAY_US';
    const currency = this.configService.get<string>('EBAY_CURRENCY') ?? 'USD';
    const baseUrl = (this.configService.get<string>('EBAY_API_BASE') ?? 'https://api.sandbox.ebay.com').replace(/\/$/, '');
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': this.configService.get<string>('EBAY_CONTENT_LANGUAGE') ?? 'en-US',
    };

    await this.request(
      `${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          availability: { shipToLocationAvailability: { quantity: 1 } },
          condition: this.mapCondition(input.inventoryItem.condition),
          product: {
            title: input.draft.title,
            description: input.draft.description,
            aspects: this.mapAspects(input.draft.itemSpecifics),
            imageUrls,
          },
        }),
      },
      'create or update the eBay inventory item',
    );

    const offersResponse = await this.request(
      `${baseUrl}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${encodeURIComponent(marketplaceId)}&format=FIXED_PRICE`,
      { method: 'GET', headers },
      'look up existing eBay offers',
    );
    const offersPayload = (await this.readJson(offersResponse)) as { offers?: Array<{ offerId?: string; listing?: { listingId?: string } }> };
    let offerId = offersPayload.offers?.find((offer) => offer.offerId)?.offerId;

    if (!offerId) {
      const offerResponse = await this.request(
        `${baseUrl}/sell/inventory/v1/offer`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sku,
            marketplaceId,
            format: 'FIXED_PRICE',
            availableQuantity: 1,
            categoryId,
            merchantLocationKey: this.requiredSetting('EBAY_MERCHANT_LOCATION_KEY'),
            listingDescription: input.draft.description,
            listingDuration: this.configService.get<string>('EBAY_LISTING_DURATION') ?? 'GTC',
            listingPolicies: {
              paymentPolicyId: this.requiredSetting('EBAY_PAYMENT_POLICY_ID'),
              returnPolicyId: this.requiredSetting('EBAY_RETURN_POLICY_ID'),
              fulfillmentPolicyId: this.requiredSetting('EBAY_FULFILLMENT_POLICY_ID'),
            },
            pricingSummary: {
              price: {
                currency,
                value: (Number(input.draft.priceCents) / 100).toFixed(2),
              },
            },
          }),
        },
        'create the eBay offer',
      );
      const offerPayload = (await this.readJson(offerResponse)) as { offerId?: string };
      offerId = offerPayload.offerId;
    }

    if (!offerId) {
      throw new BadGatewayException('eBay did not return an offer ID.');
    }

    const publishResponse = await this.request(
      `${baseUrl}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
      { method: 'POST', headers },
      'publish the eBay offer',
    );
    const publishPayload = (await this.readJson(publishResponse)) as { listingId?: string };

    if (!publishPayload.listingId) {
      throw new BadGatewayException('eBay did not return a listing ID after publishing.');
    }

    return {
      marketplaceItemId: publishPayload.listingId,
      offerId,
      listingUrl: this.buildListingUrl(publishPayload.listingId),
      status: 'active',
    };
  }

  private async request(url: string, init: RequestInit, action: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal as any });
      if (response.ok) return response;

      const body = await response.text();
      let message = body.slice(0, 1000);
      try {
        const parsed = JSON.parse(body) as { errors?: Array<{ message?: string; longMessage?: string }> };
        message = parsed.errors?.map((error) => error.longMessage ?? error.message).filter(Boolean).join(' ') || message;
      } catch {
        // Preserve the bounded raw provider response when it is not JSON.
      }

      throw new BadGatewayException(`Unable to ${action}: eBay returned ${response.status}${message ? ` — ${message}` : ''}`);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      const reason = error instanceof Error && error.name === 'AbortError' ? 'request timed out' : 'network request failed';
      throw new BadGatewayException(`Unable to ${action}: eBay ${reason}.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  private requiredSetting(name: (typeof REQUIRED_PUBLISH_SETTINGS)[number]): string {
    const value = this.configService.get<string>(name);
    if (!value) throw new BadRequestException(`Missing ${name}.`);
    return value;
  }

  private mapAspects(itemSpecifics: unknown): Record<string, string[]> {
    if (!itemSpecifics || typeof itemSpecifics !== 'object' || Array.isArray(itemSpecifics)) return {};
    return Object.fromEntries(
      Object.entries(itemSpecifics)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
        .map(([name, value]) => [name, [value.trim()]]),
    );
  }

  private mapCondition(condition: unknown): string {
    const normalized = String(condition ?? '').trim().toLowerCase();
    if (normalized.includes('new')) return 'NEW';
    if (normalized.includes('excellent') || normalized.includes('like new')) return 'USED_EXCELLENT';
    if (normalized.includes('very good')) return 'USED_VERY_GOOD';
    if (normalized.includes('acceptable') || normalized.includes('fair')) return 'USED_ACCEPTABLE';
    return 'USED_GOOD';
  }

  private buildListingUrl(listingId: string): string {
    const host = (this.configService.get<string>('EBAY_ENV') ?? 'SANDBOX').toUpperCase() === 'PRODUCTION'
      ? 'www.ebay.com'
      : 'www.sandbox.ebay.com';
    return `https://${host}/itm/${encodeURIComponent(listingId)}`;
  }
}
