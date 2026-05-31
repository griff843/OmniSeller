export type EbayImportResource = 'LISTINGS' | 'ORDERS';

export type ImportedEbayListing = {
  marketplaceItemId: string;
  offerId?: string | null;
  listingUrl?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  itemSpecifics?: Record<string, unknown> | null;
  priceCents: number;
  quantity?: number | null;
  status: 'active' | 'ended' | 'sold' | 'inactive';
  publishedAt?: Date | string | null;
};

export type ImportedEbayOrderItem = {
  marketplaceLineItemId: string;
  marketplaceItemId?: string | null;
  title?: string | null;
  quantity?: number | null;
  salePriceCents: number;
};

export type ImportedEbayOrder = {
  marketplaceOrderId: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerAddress?: Record<string, unknown> | null;
  shippingName?: string | null;
  shippingCompany?: string | null;
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  totalCents: number;
  feeCents?: number | null;
  shippingCents?: number | null;
  taxCents?: number | null;
  createdAt?: Date | string | null;
  items: ImportedEbayOrderItem[];
};

export type EbayImportSnapshot = {
  listings?: ImportedEbayListing[];
  orders?: ImportedEbayOrder[];
  cursors?: Partial<Record<EbayImportResource, string | null>>;
};

export type EbayImportResult = {
  resource: EbayImportResource;
  imported: number;
  updated: number;
  created: number;
  cursor: string | null;
  lastSyncedAt: Date;
};
