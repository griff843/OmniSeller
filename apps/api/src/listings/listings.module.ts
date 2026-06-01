import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { PublishProcessor } from './publish.processor';
import { ListingAiService } from './listing-ai.service';
import { ListingPromptBuilder } from './ai/listing-prompt-builder.service';
import { LISTING_AI_PROVIDER } from './ai/listing-ai.contract';
import { OpenAiListingProvider } from './ai/openai-listing.provider';
import { EbayPublishProvider } from './publishing/ebay-publish.provider';
import { MARKETPLACE_PUBLISH_PROVIDER } from './publishing/marketplace-publish.contract';
import { EbayModule } from '../ebay/ebay.module';

@Module({
  imports: [
    EbayModule,
    BullModule.registerQueue({
      name: 'publishListing',
    }),
  ],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    PublishProcessor,
    ListingAiService,
    ListingPromptBuilder,
    OpenAiListingProvider,
    EbayPublishProvider,
    {
      provide: LISTING_AI_PROVIDER,
      useExisting: OpenAiListingProvider,
    },
    {
      provide: MARKETPLACE_PUBLISH_PROVIDER,
      useExisting: EbayPublishProvider,
    },
  ],
  exports: [ListingsService, ListingAiService],
})
export class ListingsModule {}
