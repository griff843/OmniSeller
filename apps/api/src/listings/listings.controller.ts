import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingAiService } from './listing-ai.service';
import { ApplyAiSuggestionDto } from './dto/apply-ai-suggestion.dto';
import { UpdateListingDraftDto } from './dto/update-listing-draft.dto';
import { USER_ID_HEADER } from '../common/user-context';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly svc: ListingsService,
    private readonly listingAiService: ListingAiService,
  ) {}

  @Post(':inventoryItemId/publish')
  async publish(
    @Param('inventoryItemId') inventoryItemId: string,
    @Query('marketplace') marketplace = 'ebay',
    @Headers(USER_ID_HEADER) userId?: string,
  ) {
    return this.svc.enqueuePublish(inventoryItemId, marketplace, userId);
  }

  @Get(':inventoryItemId/ai')
  getAiWorkspace(@Param('inventoryItemId') inventoryItemId: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.listingAiService.getWorkspace(inventoryItemId, userId);
  }

  @Post(':inventoryItemId/ai/generate')
  generateAiSuggestion(@Param('inventoryItemId') inventoryItemId: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.listingAiService.generateSuggestion(inventoryItemId, userId);
  }

  @Post(':inventoryItemId/draft/apply-ai')
  applyAiSuggestion(
    @Param('inventoryItemId') inventoryItemId: string,
    @Body() dto: ApplyAiSuggestionDto,
    @Headers(USER_ID_HEADER) userId?: string,
  ): Promise<unknown> {
    return this.listingAiService.applySuggestion(inventoryItemId, dto, userId);
  }

  @Patch(':inventoryItemId/draft')
  updateDraft(
    @Param('inventoryItemId') inventoryItemId: string,
    @Body() dto: UpdateListingDraftDto,
    @Headers(USER_ID_HEADER) userId?: string,
  ): Promise<unknown> {
    return this.listingAiService.updateDraft(inventoryItemId, dto, userId);
  }
}
