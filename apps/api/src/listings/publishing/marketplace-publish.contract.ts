export const MARKETPLACE_PUBLISH_PROVIDER = Symbol('MARKETPLACE_PUBLISH_PROVIDER');

export type PublishAvailability =
  | {
      available: true;
      marketplaceAccount: {
        id: string;
        kind: string;
        siteId?: string | null;
        accessToken?: string | null;
        refreshToken?: string | null;
        expiresAt?: Date | string | null;
      };
    }
  | {
      available: false;
      reason: string;
    };

export type PublishDraftInput = {
  inventoryItem: any;
  draft: any;
  marketplace: string;
  marketplaceAccount: {
    id: string;
    kind: string;
    siteId?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: Date | string | null;
  };
};

export type PublishDraftResult = {
  marketplaceItemId: string;
  listingUrl?: string | null;
  offerId?: string | null;
  status?: string | null;
};

export interface MarketplacePublishProvider {
  getAvailability(marketplace: string, marketplaceAccount: any | null): PublishAvailability;
  publishDraft(input: PublishDraftInput): Promise<PublishDraftResult>;
}
