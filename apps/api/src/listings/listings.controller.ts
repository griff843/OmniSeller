import { Controller, Get, Param, Patch, Post, Query, Body } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingAiService } from './listing-ai.service';
import { ApplyAiSuggestionDto } from './dto/apply-ai-suggestion.dto';
import { UpdateListingDraftDto } from './dto/update-listing-draft.dto';

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
  ) {
    await this.svc.enqueuePublish(inventoryItemId, marketplace);
    return 'publish queued';
  }

  @Get(':inventoryItemId/ai')
  getAiWorkspace(@Param('inventoryItemId') inventoryItemId: string): Promise<unknown> {
    return this.listingAiService.getWorkspace(inventoryItemId);
  }

  @Post(':inventoryItemId/ai/generate')
  generateAiSuggestion(@Param('inventoryItemId') inventoryItemId: string): Promise<unknown> {
    return this.listingAiService.generateSuggestion(inventoryItemId);
  }

  @Post(':inventoryItemId/draft/apply-ai')
  applyAiSuggestion(
    @Param('inventoryItemId') inventoryItemId: string,
    @Body() dto: ApplyAiSuggestionDto,
  ): Promise<unknown> {
    return this.listingAiService.applySuggestion(inventoryItemId, dto);
  }

  @Patch(':inventoryItemId/draft')
  updateDraft(
    @Param('inventoryItemId') inventoryItemId: string,
    @Body() dto: UpdateListingDraftDto,
  ): Promise<unknown> {
    return this.listingAiService.updateDraft(inventoryItemId, dto);
  }
}
