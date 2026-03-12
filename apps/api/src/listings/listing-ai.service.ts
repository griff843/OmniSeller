import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiListingSuggestionStatus, prisma } from '@omniseller/db';
import { ApplyAiSuggestionDto } from './dto/apply-ai-suggestion.dto';
import { UpdateListingDraftDto } from './dto/update-listing-draft.dto';
import {
  LISTING_AI_PROVIDER,
  LISTING_PROMPT_VERSION,
  ListingAiProvider,
  ListingGenerationInput,
} from './ai/listing-ai.contract';
import {
  buildReadinessBlockers,
  determineListingReadiness,
  determineSaleStatus,
  isPublishReady,
} from '../inventory/inventory-workflow-state';

@Injectable()
export class ListingAiService {
  constructor(
    @Inject(LISTING_AI_PROVIDER)
    private readonly provider: ListingAiProvider,
  ) {}

  async getWorkspace(inventoryItemId: string): Promise<unknown> {
    const item = await this.requireInventoryItem(inventoryItemId);

    return {
      inventoryItemId: item.id,
      draft: this.serializeDraft(item.listingDraft),
      latestSuggestion: item.aiListingSuggestions[0]
        ? this.serializeSuggestion(item.aiListingSuggestions[0])
        : null,
      suggestionHistory: item.aiListingSuggestions.map((suggestion: any) => this.serializeSuggestion(suggestion)),
      sourceContext: {
        sku: item.sku,
        title: item.title,
        description: item.description,
        brand: item.brand,
        model: item.model,
        category: item.category,
        condition: item.condition,
        photoCount: item.photos.length,
      },
      workflow: this.serializeWorkflow(item),
    };
  }

  async generateSuggestion(inventoryItemId: string): Promise<unknown> {
    const item = await this.requireInventoryItem(inventoryItemId);
    const readyPhotoCount = (item.photos ?? []).filter((photo: any) => Boolean(photo.url)).length;

    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI listing generation is unavailable in this environment. Add OPENAI_API_KEY to enable it.',
      );
    }

    if (readyPhotoCount === 0) {
      throw new BadRequestException('At least one ready photo is required before generating an AI listing.');
    }

    const sourceSnapshot = this.buildSourceSnapshot(item);

    try {
      const result = await this.provider.generateSuggestion(sourceSnapshot);

      const suggestion = await prisma.aiListingSuggestion.create({
        data: {
          inventoryItemId,
          provider: result.provider,
          model: result.model,
          promptVersion: LISTING_PROMPT_VERSION,
          status: AiListingSuggestionStatus.GENERATED,
          title: result.output.title,
          description: result.output.description,
          suggestedCategory: result.output.category,
          suggestedPriceCents: result.output.priceCents,
          itemSpecifics: result.output.itemSpecifics,
          sourceSnapshot,
          rawResponse: result.rawResponse as any,
          generatedAt: new Date(),
        },
      });

      await this.syncInventoryWorkflowState(inventoryItemId);
      return this.serializeSuggestion(suggestion);
    } catch (error) {
      await prisma.aiListingSuggestion.create({
        data: {
          inventoryItemId,
          provider: 'openai',
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          promptVersion: LISTING_PROMPT_VERSION,
          status: AiListingSuggestionStatus.FAILED,
          sourceSnapshot,
          errorMessage: error instanceof Error ? error.message : 'Unknown AI generation failure',
        },
      });

      await this.syncInventoryWorkflowState(inventoryItemId);
      throw error instanceof Error
        ? new InternalServerErrorException(error.message)
        : new InternalServerErrorException('AI listing generation failed');
    }
  }

  async applySuggestion(inventoryItemId: string, dto: ApplyAiSuggestionDto): Promise<unknown> {
    const suggestion = await prisma.aiListingSuggestion.findFirst({
      where: {
        id: dto.suggestionId,
        inventoryItemId,
        status: { not: AiListingSuggestionStatus.FAILED },
      },
    });

    if (!suggestion) {
      throw new NotFoundException(`AI listing suggestion ${dto.suggestionId} not found`);
    }

    const draftPatch: Record<string, unknown> = {};

    for (const field of dto.fields) {
      switch (field) {
        case 'title':
          draftPatch.title = suggestion.title;
          break;
        case 'description':
          draftPatch.description = suggestion.description;
          break;
        case 'category':
          draftPatch.category = suggestion.suggestedCategory;
          break;
        case 'priceCents':
          draftPatch.priceCents = suggestion.suggestedPriceCents;
          break;
        case 'itemSpecifics':
          draftPatch.itemSpecifics = suggestion.itemSpecifics;
          break;
        default:
          throw new BadRequestException(`Unsupported draft field ${field}`);
      }
    }

    const draft = await prisma.listingDraft.upsert({
      where: { inventoryItemId },
      update: {
        ...draftPatch,
        sourceSuggestionId: suggestion.id,
      },
      create: {
        inventoryItemId,
        marketplace: 'ebay',
        ...draftPatch,
        sourceSuggestionId: suggestion.id,
      },
    });

    await prisma.aiListingSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: AiListingSuggestionStatus.APPLIED,
        appliedAt: new Date(),
      },
    });

    await this.syncInventoryWorkflowState(inventoryItemId);
    return this.serializeDraft(draft);
  }

  async updateDraft(inventoryItemId: string, dto: UpdateListingDraftDto): Promise<unknown> {
    const normalizedSpecifics = dto.itemSpecifics
      ? Object.fromEntries(
          Object.entries(dto.itemSpecifics)
            .map(([key, value]) => [key.trim(), value.trim()])
            .filter(([key, value]) => key.length > 0 && value.length > 0),
        )
      : undefined;

    const draft = await prisma.listingDraft.upsert({
      where: { inventoryItemId },
      update: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(normalizedSpecifics !== undefined ? { itemSpecifics: normalizedSpecifics } : {}),
      },
      create: {
        inventoryItemId,
        marketplace: 'ebay',
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priceCents: dto.priceCents,
        itemSpecifics: normalizedSpecifics,
      },
    });

    await this.syncInventoryWorkflowState(inventoryItemId);
    return this.serializeDraft(draft);
  }

  private async requireInventoryItem(inventoryItemId: string): Promise<any> {
    const item: any = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        photos: {
          where: {
            deletedAt: null,
            uploadStatus: 'READY',
            url: { not: null },
          },
          orderBy: [{ isPrimary: 'desc' }, { sort: 'asc' }, { createdAt: 'asc' }],
        },
        listingDraft: true,
        listings: {
          orderBy: { createdAt: 'desc' },
        },
        aiListingSuggestions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    } as any);

    if (!item) {
      throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
    }

    return item;
  }

  private buildSourceSnapshot(item: any): ListingGenerationInput {
    return {
      inventoryItemId: item.id,
      sku: item.sku,
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      brand: item.brand,
      model: item.model,
      upc: item.upc,
      costBasisCents: item.costBasisCents,
      photoContexts: (item.photos ?? [])
        .filter((photo: any) => typeof photo.url === 'string' && photo.url.length > 0)
        .map((photo: any) => ({
          url: photo.url,
          isPrimary: photo.isPrimary,
          originalFileName: photo.originalFileName,
        })),
    };
  }

  private async syncInventoryWorkflowState(inventoryItemId: string) {
    const item: any = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        photos: {
          where: {
            deletedAt: null,
          },
        },
        listingDraft: true,
        listings: true,
        aiListingSuggestions: {
          where: {
            status: { not: AiListingSuggestionStatus.FAILED },
          },
          take: 1,
        },
      },
    } as any);

    if (!item) {
      return;
    }

    const readyPhotoCount = (item.photos ?? []).filter(
      (photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url),
    ).length;
    const hasPublishableDraft = Boolean(
      item.listingDraft?.title?.trim() &&
      item.listingDraft?.description?.trim() &&
      item.listingDraft?.category?.trim() &&
      item.listingDraft?.priceCents !== null &&
      item.listingDraft?.priceCents !== undefined,
    );
    const hasActiveListing = (item.listings ?? []).length > 0;
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: (item.aiListingSuggestions ?? []).length > 0,
      hasDraft: Boolean(item.listingDraft),
      hasPublishableDraft,
      hasActiveListing,
      saleStatus: item.saleStatus ?? 'AVAILABLE',
    } as const;

    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        listingReadiness: determineListingReadiness(snapshot),
        saleStatus: determineSaleStatus(item.saleStatus ?? 'AVAILABLE', hasActiveListing),
      },
    } as any);
  }

  private serializeSuggestion(suggestion: any) {
    return {
      id: suggestion.id,
      inventoryItemId: suggestion.inventoryItemId,
      provider: suggestion.provider,
      model: suggestion.model,
      promptVersion: suggestion.promptVersion,
      status: suggestion.status,
      title: suggestion.title,
      description: suggestion.description,
      suggestedCategory: suggestion.suggestedCategory,
      suggestedPriceCents: suggestion.suggestedPriceCents,
      itemSpecifics: suggestion.itemSpecifics,
      errorMessage: suggestion.errorMessage,
      generatedAt: suggestion.generatedAt,
      appliedAt: suggestion.appliedAt,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
    };
  }

  private serializeDraft(draft: any) {
    if (!draft) {
      return null;
    }

    return {
      id: draft.id,
      inventoryItemId: draft.inventoryItemId,
      marketplace: draft.marketplace,
      title: draft.title,
      description: draft.description,
      category: draft.category,
      priceCents: draft.priceCents,
      itemSpecifics: draft.itemSpecifics ?? {},
      sourceSuggestionId: draft.sourceSuggestionId,
      updatedAt: draft.updatedAt,
      createdAt: draft.createdAt,
    };
  }

  private serializeWorkflow(item: any) {
    const readyPhotoCount = (item.photos ?? []).filter((photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url)).length;
    const hasPublishableDraft = Boolean(
      item.listingDraft?.title?.trim() &&
      item.listingDraft?.description?.trim() &&
      item.listingDraft?.category?.trim() &&
      item.listingDraft?.priceCents !== null &&
      item.listingDraft?.priceCents !== undefined,
    );
    const hasDraft = Boolean(item.listingDraft);
    const hasActiveListing = (item.listings ?? []).length > 0;
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: (item.aiListingSuggestions ?? []).length > 0,
      hasDraft,
      hasPublishableDraft,
      hasActiveListing,
      saleStatus: item.saleStatus ?? 'AVAILABLE',
    } as const;
    const draftMissingFields = [
      !item.listingDraft?.title?.trim() ? 'title' : null,
      !item.listingDraft?.description?.trim() ? 'description' : null,
      !item.listingDraft?.category?.trim() ? 'category' : null,
      item.listingDraft?.priceCents === null || item.listingDraft?.priceCents === undefined ? 'price' : null,
    ].filter((value): value is string => value !== null);

    return {
      listingReadiness: item.listingReadiness ?? 'NEEDS_INTAKE',
      saleStatus: item.saleStatus ?? 'AVAILABLE',
      aiConfigured: this.provider.isConfigured(),
      canGenerateAi: this.provider.isConfigured() && readyPhotoCount > 0,
      aiBlockedReason: !this.provider.isConfigured()
        ? 'AI listing generation is unavailable in this environment. Add OPENAI_API_KEY to enable it.'
        : readyPhotoCount === 0
          ? 'Upload at least one ready photo before generating an AI listing.'
          : null,
      hasDraft,
      hasPublishableDraft,
      draftState: hasActiveListing ? 'LISTED' : !hasDraft ? 'NONE' : hasPublishableDraft ? 'READY' : 'INCOMPLETE',
      draftMissingFields,
      canPublish: isPublishReady(snapshot),
      publishBlockedReason: isPublishReady(snapshot) ? null : buildReadinessBlockers(snapshot)[0] ?? null,
      readinessBlockers: buildReadinessBlockers(snapshot),
    };
  }
}

