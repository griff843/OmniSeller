export type AiListingSuggestion = {
  id: string;
  inventoryItemId: string;
  provider: string;
  model: string;
  promptVersion: string;
  status: 'GENERATED' | 'APPLIED' | 'FAILED';
  title: string | null;
  description: string | null;
  suggestedCategory: string | null;
  suggestedPriceCents: number | null;
  itemSpecifics: Record<string, string> | null;
  errorMessage: string | null;
  generatedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListingDraft = {
  id: string;
  inventoryItemId: string;
  marketplace: string;
  title: string | null;
  description: string | null;
  category: string | null;
  priceCents: number | null;
  itemSpecifics: Record<string, string>;
  sourceSuggestionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiListingWorkspace = {
  inventoryItemId: string;
  draft: ListingDraft | null;
  latestSuggestion: AiListingSuggestion | null;
  suggestionHistory: AiListingSuggestion[];
  sourceContext: {
    sku: string;
    title: string | null;
    description: string | null;
    brand: string | null;
    model: string | null;
    category: string | null;
    condition: string | null;
    photoCount: number;
  };
};

export function formatDraftPrice(priceCents: number | null) {
  if (priceCents === null || priceCents === undefined) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
}
