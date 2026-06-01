import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount } from '@omniseller/db';
import fetch from 'node-fetch';
import { EbayTokenService } from './ebay-token.service';
import {
  EbayPriceIntelligenceAvailability,
  EbaySoldComp,
  EbaySoldCompsProvider,
  EbaySoldCompsQuery,
  EbaySoldCompsResult,
} from './ebay-price-intelligence.types';

type EbayItemSalesResponse = {
  itemSales?: EbayItemSale[];
  itemSummaries?: EbayItemSale[];
  items?: EbayItemSale[];
};

type EbayItemSale = {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  itemWebUrl?: string;
  itemUrl?: string;
  itemAffiliateWebUrl?: string;
  price?: {
    value?: string;
    currency?: string;
  };
  currentBidPrice?: {
    value?: string;
    currency?: string;
  };
  condition?: string;
  conditionId?: string;
  itemSoldDate?: string;
  lastSoldDate?: string;
  itemEndDate?: string;
  image?: {
    imageUrl?: string;
  };
  thumbnailImages?: Array<{
    imageUrl?: string;
  }>;
};

@Injectable()
export class EbayPriceIntelligenceProvider implements EbaySoldCompsProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly ebayTokenService: EbayTokenService,
  ) {}

  getAvailability(account?: MarketplaceAccount | null): EbayPriceIntelligenceAvailability {
    if (this.configService.get<string>('EBAY_PRICE_INTELLIGENCE_ENABLED') !== 'true') {
      return {
        available: false,
        reason: 'Set EBAY_PRICE_INTELLIGENCE_ENABLED=true to enable eBay sold comps lookup.',
      };
    }

    if (!account) {
      return {
        available: false,
        reason: 'Connect an eBay marketplace account before looking up sold comps.',
      };
    }

    if (!account.refreshToken) {
      return {
        available: false,
        reason: 'eBay marketplace credentials are incomplete. Reconnect the marketplace account before looking up sold comps.',
      };
    }

    return { available: true };
  }

  async fetchSoldComps(account: MarketplaceAccount, query: EbaySoldCompsQuery): Promise<EbaySoldCompsResult> {
    const availability = this.getAvailability(account);

    if (!availability.available) {
      throw new ServiceUnavailableException(availability.reason);
    }

    const normalizedQuery = query.q.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Sold comps query is required.');
    }

    const marketplaceId = this.resolveMarketplaceId(query.marketplaceId, account);
    const accessToken = await this.ebayTokenService.getValidAccessToken(account);
    const data = await this.fetchJson<EbayItemSalesResponse>(
      accessToken,
      this.buildSearchPath({
        ...query,
        q: normalizedQuery,
        marketplaceId,
        limit: this.resolveLimit(query.limit),
      }),
      marketplaceId,
    );

    return {
      provider: 'ebay',
      marketplaceId,
      query: {
        q: normalizedQuery,
        categoryId: query.categoryId ?? null,
        marketplaceId,
        limit: this.resolveLimit(query.limit),
      },
      comps: this.mapComps(data),
      requestedAt: new Date().toISOString(),
    };
  }

  private buildSearchPath(query: Required<Pick<EbaySoldCompsQuery, 'q' | 'marketplaceId' | 'limit'>> & EbaySoldCompsQuery) {
    const params = new URLSearchParams({
      q: query.q,
      limit: String(query.limit),
    });

    if (query.categoryId?.trim()) {
      params.set('category_ids', query.categoryId.trim());
    }

    return `${this.getSearchPath()}?${params.toString()}`;
  }

  private mapComps(data: EbayItemSalesResponse): EbaySoldComp[] {
    const items = data.itemSales ?? data.itemSummaries ?? data.items ?? [];

    return items
      .map((item) => {
        const marketplaceItemId = item.itemId ?? item.legacyItemId;
        const price = item.price ?? item.currentBidPrice;

        if (!marketplaceItemId || !price?.value) {
          return null;
        }

        return {
          marketplaceItemId,
          title: item.title ?? null,
          itemUrl: item.itemWebUrl ?? item.itemUrl ?? item.itemAffiliateWebUrl ?? null,
          soldPriceCents: this.moneyToCents(price.value),
          currency: price.currency ?? null,
          condition: item.condition ?? item.conditionId ?? null,
          soldAt: item.itemSoldDate ?? item.lastSoldDate ?? item.itemEndDate ?? null,
          imageUrl: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl ?? null,
        };
      })
      .filter((comp): comp is EbaySoldComp => Boolean(comp));
  }

  private async fetchJson<T>(accessToken: string, path: string, marketplaceId: string): Promise<T> {
    const response = await fetch(`${this.getApiBase()}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      },
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`eBay sold comps request failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as T;
  }

  private resolveMarketplaceId(marketplaceId: string | null | undefined, account: MarketplaceAccount) {
    return marketplaceId?.trim() || this.configService.get<string>('EBAY_MARKETPLACE_ID') || account.siteId?.replace('-', '_') || 'EBAY_US';
  }

  private resolveLimit(limit: number | null | undefined) {
    const configured = Number(this.configService.get<string>('EBAY_PRICE_INTELLIGENCE_LIMIT'));
    const fallback = Number.isFinite(configured) && configured > 0 ? configured : 20;
    const value = limit ?? fallback;

    return Math.min(Math.max(value, 1), 50);
  }

  private moneyToCents(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  }

  private getSearchPath() {
    return this.configService.get<string>('EBAY_PRICE_INTELLIGENCE_PATH') ?? '/buy/marketplace_insights/v1_beta/item_sales/search';
  }

  private getApiBase() {
    if (this.configService.get<string>('EBAY_PRICE_INTELLIGENCE_API_BASE')) {
      return this.configService.get<string>('EBAY_PRICE_INTELLIGENCE_API_BASE') as string;
    }

    if (this.configService.get<string>('EBAY_API_BASE')) {
      return this.configService.get<string>('EBAY_API_BASE') as string;
    }

    return this.configService.get<string>('EBAY_ENV') === 'SANDBOX'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }
}
