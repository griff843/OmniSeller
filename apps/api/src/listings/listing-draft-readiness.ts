type ListingDraftLike = {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  priceCents?: number | null;
  itemSpecifics?: Record<string, unknown> | null;
  metadata?: unknown;
};

type EbayDraftMetadata = {
  categoryId?: unknown;
  requiredAspects?: unknown;
};

export function getEbayDraftMetadata(draft?: ListingDraftLike | null): EbayDraftMetadata | null {
  const metadata = draft?.metadata;

  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const ebay = (metadata as Record<string, unknown>).ebay;
  return ebay && typeof ebay === 'object' ? (ebay as EbayDraftMetadata) : null;
}

export function getEbayCategoryId(draft?: ListingDraftLike | null): string | null {
  const categoryId = getEbayDraftMetadata(draft)?.categoryId;
  const normalized = typeof categoryId === 'string' ? categoryId.trim() : '';

  return /^\d+$/.test(normalized) ? normalized : null;
}

export function getRequiredEbayAspects(draft?: ListingDraftLike | null): string[] {
  const requiredAspects = getEbayDraftMetadata(draft)?.requiredAspects;

  if (!Array.isArray(requiredAspects)) {
    return [];
  }

  return requiredAspects
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getDraftMissingFields(draft?: ListingDraftLike | null): string[] {
  const missingFields = [
    !draft?.title?.trim() ? 'title' : null,
    !draft?.description?.trim() ? 'description' : null,
    !draft?.category?.trim() ? 'category' : null,
    draft?.priceCents === null || draft?.priceCents === undefined ? 'price' : null,
    !getEbayCategoryId(draft) ? 'eBay category ID' : null,
  ].filter((value): value is string => value !== null);

  const itemSpecifics = draft?.itemSpecifics ?? {};
  const missingAspects = getRequiredEbayAspects(draft)
    .filter((aspectName) => {
      const value = itemSpecifics[aspectName];
      return typeof value !== 'string' || value.trim().length === 0;
    })
    .map((aspectName) => `item specific: ${aspectName}`);

  return [...missingFields, ...missingAspects];
}

export function hasPublishableListingDraft(draft?: ListingDraftLike | null): boolean {
  return getDraftMissingFields(draft).length === 0;
}
