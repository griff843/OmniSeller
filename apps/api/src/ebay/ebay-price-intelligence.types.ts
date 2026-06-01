import { MarketplaceAccount } from '@omniseller/db';

export type EbaySoldCompsQuery = {
  q: string;
  categoryId?: string | null;
  marketplaceId?: string | null;
  limit?: number | null;
};

export type EbaySoldComp = {
  marketplaceItemId: string;
  title: string | null;
  itemUrl: string | null;
  soldPriceCents: number;
  currency: string | null;
  condition: string | null;
  soldAt: string | null;
  imageUrl: string | null;
};

export type EbaySoldCompsResult = {
  provider: 'ebay';
  marketplaceId: string;
  query: EbaySoldCompsQuery;
  comps: EbaySoldComp[];
  requestedAt: string;
};

export type EbayPriceIntelligenceAvailability = {
  available: boolean;
  reason?: string;
};

export interface EbaySoldCompsProvider {
  getAvailability(account?: MarketplaceAccount | null): EbayPriceIntelligenceAvailability;
  fetchSoldComps(account: MarketplaceAccount, query: EbaySoldCompsQuery): Promise<EbaySoldCompsResult>;
}
