import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { PublishProcessor } from './publish.processor';
import { ListingAiService } from './listing-ai.service';
import { ListingPromptBuilder } from './ai/listing-prompt-builder.service';
import { LISTING_AI_PROVIDER } from './ai/listing-ai.contract';
import { OpenAiListingProvider } from './ai/openai-listing.provider';

@Module({
  imports: [
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
    {
      provide: LISTING_AI_PROVIDER,
      useExisting: OpenAiListingProvider,
    },
  ],
  exports: [ListingsService, ListingAiService],
})
export class ListingsModule {}
