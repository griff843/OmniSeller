import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  MarketplacePublishProvider,
  PublishAvailability,
  PublishDraftInput,
  PublishDraftResult,
} from './marketplace-publish.contract';

@Injectable()
export class EbayPublishProvider implements MarketplacePublishProvider {
  getAvailability(marketplace: string, marketplaceAccount: any | null): PublishAvailability {
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

  async publishDraft(_: PublishDraftInput): Promise<PublishDraftResult> {
    throw new ServiceUnavailableException(
      'eBay publish transport is not configured for this local environment yet.',
    );
  }
}
