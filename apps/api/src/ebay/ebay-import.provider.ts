import { Injectable } from '@nestjs/common';
import { MarketplaceAccount } from '@omniseller/db';
import { EbayImportSnapshot } from './ebay-import.types';

@Injectable()
export class EbayImportProvider {
  async fetchSnapshot(account: MarketplaceAccount): Promise<EbayImportSnapshot> {
    void account;

    return {
      listings: [],
      orders: [],
      cursors: {
        LISTINGS: null,
        ORDERS: null,
      },
    };
  }
}
