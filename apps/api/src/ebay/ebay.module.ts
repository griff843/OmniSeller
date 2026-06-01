import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';
import { EbayImportProvider } from './ebay-import.provider';
import { EbayImportService } from './ebay-import.service';
import { EbayTokenService } from './ebay-token.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { EbaySyncProcessor } from './ebay-sync.processor';
import { EbaySyncScheduler } from './ebay-sync.scheduler';
import { EBAY_SYNC_QUEUE } from './ebay-sync.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: EBAY_SYNC_QUEUE,
    }),
  ],
  controllers: [EbayController],
  providers: [
    EbayService,
    EbayImportProvider,
    EbayImportService,
    EbayTokenService,
    EbayTaxonomyService,
    EbaySyncProcessor,
    EbaySyncScheduler,
  ],
  exports: [EbayService, EbayImportService, EbayTokenService, EbayTaxonomyService],
})
export class EbayModule {}
