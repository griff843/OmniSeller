export type InventoryStatus = 'DRAFT' | 'IN_STOCK' | 'HOLD' | 'ARCHIVED';
export type ListingReadiness = 'NEEDS_INTAKE' | 'NEEDS_PHOTOS' | 'READY_FOR_AI' | 'READY_FOR_LISTING' | 'READY_TO_PUBLISH' | 'LISTED';
export type SaleStatus = 'AVAILABLE' | 'LISTED' | 'RESERVED' | 'SOLD' | 'SHIPPED';

export type InventoryBin = {
  id: string;
  code: string;
  label: string | null;
  area: string | null;
  note: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryWorkflow = {
  canGenerateAi: boolean;
  canEditDraft: boolean;
  canPublish: boolean;
  canRequestPublish: boolean;
  publishActionBlockedReason: string | null;
  readinessBlockers: string[];
};

export type PublishExecutionStatus =
  | 'NOT_REQUESTED'
  | 'BLOCKED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'PUBLISHED';

export type InventoryPublishState = {
  status: PublishExecutionStatus;
  marketplace: string;
  requestedAt: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  publishedAt: string | null;
  failedAt: string | null;
  error: string | null;
  message: string;
  canRetry: boolean;
  isInFlight: boolean;
};

export type InventoryPhoto = {
  id: string;
  inventoryItemId: string;
  url: string | null;
  storageBucket: string;
  storageKey: string;
  role: 'ORIGINAL' | 'PROCESSED' | 'THUMBNAIL';
  uploadStatus: 'PENDING' | 'UPLOADING' | 'READY' | 'PROCESSING' | 'FAILED' | 'DELETED';
  sort: number;
  isPrimary: boolean;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown> | null;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItemDetail = {
  id: string;
  sku: string;
  skuManuallySet: boolean;
  title: string | null;
  description: string | null;
  category: string | null;
  condition: string | null;
  brand: string | null;
  model: string | null;
  upc: string | null;
  scanCode: string | null;
  inventoryStatus: InventoryStatus;
  listingReadiness: ListingReadiness;
  saleStatus: SaleStatus;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  readyPhotoCount: number;
  primaryPhoto: InventoryPhoto | null;
  photos: InventoryPhoto[];
  bin: InventoryBin | null;
  listingCount: number;
  publishState: InventoryPublishState;
  workflow: InventoryWorkflow;
  scanner: {
    provider: string;
    canLookupByScanCode: boolean;
    note: string;
  };
};

export type InventoryListResponse = {
  items: InventoryItemDetail[];
  filters: {
    q?: string;
    binCode?: string;
    inventoryStatus?: string;
    listingReadiness?: string;
    saleStatus?: string;
    sort?: string;
  };
};

export type InventoryBulkAction = 'MARK_READY_FOR_LISTING' | 'MARK_HOLD' | 'MARK_AVAILABLE' | 'ARCHIVE' | 'ASSIGN_BIN';

export type InventoryBulkUpdateResponse = {
  action: InventoryBulkAction;
  requested: number;
  counts: {
    updated: number;
    notFound: number;
    failed: number;
  };
  results: Array<{
    itemId: string;
    status: 'updated' | 'not_found' | 'failed';
    message?: string;
  }>;
};

export type InventoryCsvImportField =
  | 'sku'
  | 'title'
  | 'description'
  | 'category'
  | 'condition'
  | 'brand'
  | 'model'
  | 'upc'
  | 'scanCode'
  | 'costBasisCents'
  | 'binCode';

export type InventoryCsvImportPreviewRow = {
  rowNumber: number;
  normalized: Partial<Record<InventoryCsvImportField, string | number | null>>;
  errors: string[];
  warnings: string[];
};

export type InventoryCsvImportPreviewResponse = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  headers: string[];
  rows: InventoryCsvImportPreviewRow[];
};

export type InventoryCsvImportApplyResponse = {
  requestedRows: number;
  created: number;
  failed: number;
  skipped: number;
  duplicateSku: number;
  binsCreated: number;
  results: Array<{
    rowNumber: number;
    status: 'created' | 'failed' | 'skipped';
    itemId?: string;
    sku?: string;
    message?: string;
    errors?: string[];
    warnings?: string[];
  }>;
};

export type PhotoUploadReservation = {
  id: string;
  inventoryItemId: string;
  url: string | null;
  storageBucket: string;
  storageKey: string;
  role: InventoryPhoto['role'];
  uploadStatus: InventoryPhoto['uploadStatus'];
  sort: number;
  isPrimary: boolean;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown> | null;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
  signedUploadUrl?: string;
  publicUrl?: string;
};

export function formatBytes(size: number | null) {
  if (!size) return '--';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function uploadTone(status: InventoryPhoto['uploadStatus']) {
  switch (status) {
    case 'READY':
      return 'success';
    case 'UPLOADING':
    case 'PROCESSING':
      return 'info';
    case 'FAILED':
      return 'danger';
    default:
      return 'warning';
  }
}
