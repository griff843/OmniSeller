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
  readinessBlockers: string[];
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
