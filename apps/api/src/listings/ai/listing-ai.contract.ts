import { z } from 'zod';

export const listingSuggestionSchema = z.object({
  title: z.string().min(10).max(80),
  description: z.string().min(40).max(4000),
  category: z.string().min(2).max(120),
  priceCents: z.number().int().min(100).max(1_000_000),
  itemSpecifics: z.record(z.string().min(1), z.string().min(1)).default({}),
});

export type ListingSuggestionOutput = z.infer<typeof listingSuggestionSchema>;

export type ListingGenerationInput = {
  inventoryItemId: string;
  sku: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  brand?: string | null;
  model?: string | null;
  upc?: string | null;
  costBasisCents: number;
  photoContexts: Array<{
    url: string;
    isPrimary: boolean;
    originalFileName?: string | null;
  }>;
};

export type ListingGenerationResult = {
  provider: string;
  model: string;
  output: ListingSuggestionOutput;
  rawResponse: unknown;
};

export interface ListingAiProvider {
  generateSuggestion(input: ListingGenerationInput): Promise<ListingGenerationResult>;
}

export const LISTING_AI_PROVIDER = Symbol('LISTING_AI_PROVIDER');
export const LISTING_PROMPT_VERSION = 'ai-listing-v1';
