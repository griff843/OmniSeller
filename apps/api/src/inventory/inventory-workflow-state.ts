export type InventoryStatusValue = 'DRAFT' | 'IN_STOCK' | 'HOLD' | 'ARCHIVED';
export type ListingReadinessValue =
  | 'NEEDS_INTAKE'
  | 'NEEDS_PHOTOS'
  | 'READY_FOR_AI'
  | 'READY_FOR_LISTING'
  | 'READY_TO_PUBLISH'
  | 'LISTED';
export type SaleLifecycleStatusValue = 'AVAILABLE' | 'LISTED' | 'RESERVED' | 'SOLD' | 'SHIPPED';

export type InventoryWorkflowSnapshot = {
  title: string | null;
  condition: string | null;
  readyPhotoCount: number;
  hasSuggestion: boolean;
  hasDraft: boolean;
  hasPublishableDraft: boolean;
  hasActiveListing: boolean;
  saleStatus: SaleLifecycleStatusValue;
};

export function normalizeSku(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildGeneratedSku(params: { id: string; createdAt?: Date }): string {
  const createdAt = params.createdAt ?? new Date();
  const dateSegment = `${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}${String(createdAt.getUTCDate()).padStart(2, '0')}`;
  const idSegment = params.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase().padStart(6, '0');
  return `INV-${dateSegment}-${idSegment}`;
}

export function determineListingReadiness(snapshot: InventoryWorkflowSnapshot): ListingReadinessValue {
  if (snapshot.hasActiveListing) {
    return 'LISTED';
  }

  const hasIntakeCore = Boolean(snapshot.title?.trim()) && Boolean(snapshot.condition?.trim());

  if (!hasIntakeCore) {
    return 'NEEDS_INTAKE';
  }

  if (snapshot.readyPhotoCount === 0) {
    return 'NEEDS_PHOTOS';
  }

  if (snapshot.hasPublishableDraft) {
    return 'READY_TO_PUBLISH';
  }

  if (snapshot.hasDraft || snapshot.hasSuggestion) {
    return 'READY_FOR_LISTING';
  }

  return 'READY_FOR_AI';
}

export function determineSaleStatus(currentStatus: SaleLifecycleStatusValue, hasActiveListing: boolean): SaleLifecycleStatusValue {
  if (currentStatus === 'RESERVED' || currentStatus === 'SOLD' || currentStatus === 'SHIPPED') {
    return currentStatus;
  }

  return hasActiveListing ? 'LISTED' : 'AVAILABLE';
}

export function buildReadinessBlockers(snapshot: InventoryWorkflowSnapshot): string[] {
  const blockers: string[] = [];

  if (!snapshot.title?.trim()) {
    blockers.push('Add an item title before generating listing work.');
  }

  if (!snapshot.condition?.trim()) {
    blockers.push('Set the item condition so listing and pricing context are trustworthy.');
  }

  if (snapshot.readyPhotoCount === 0) {
    blockers.push('Upload at least one ready photo to unlock AI and listing workflows.');
  }

  if (!snapshot.hasPublishableDraft) {
    blockers.push('Complete a draft title, description, category, and price before publish.');
  }

  return blockers;
}
