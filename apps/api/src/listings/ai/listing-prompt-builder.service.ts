import { Injectable } from '@nestjs/common';
import { ListingGenerationInput } from './listing-ai.contract';

@Injectable()
export class ListingPromptBuilder {
  buildSystemInstruction() {
    return [
      'You create reseller listing drafts from inventory data and photo context.',
      'Return only structured listing suggestions for a human operator to review.',
      'Do not invent brand, model, condition, or specifications unless strongly supported by the provided context.',
      'Prefer marketplace-safe wording, concise titles, and factual descriptions.',
      'Suggested price should be a realistic reseller draft price in USD cents.',
    ].join(' ');
  }

  buildUserContext(input: ListingGenerationInput) {
    return {
      inventoryItemId: input.inventoryItemId,
      sku: input.sku,
      title: input.title ?? null,
      description: input.description ?? null,
      category: input.category ?? null,
      condition: input.condition ?? null,
      brand: input.brand ?? null,
      model: input.model ?? null,
      upc: input.upc ?? null,
      costBasisCents: input.costBasisCents,
      photos: input.photoContexts.map((photo, index) => ({
        index: index + 1,
        isPrimary: photo.isPrimary,
        originalFileName: photo.originalFileName ?? null,
        url: photo.url,
      })),
    };
  }
}
