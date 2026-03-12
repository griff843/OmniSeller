export type ShipmentStatus =
  | 'PENDING'
  | 'LABEL_PURCHASED'
  | 'SYNC_QUEUED'
  | 'SYNCED_TO_MARKETPLACE'
  | 'VOIDED'
  | 'ERROR';

export type ShipmentExecutionState =
  | 'NOT_STARTED'
  | 'PURCHASE_REQUESTED'
  | 'LABEL_PURCHASED'
  | 'SYNC_QUEUED'
  | 'FULFILLED'
  | 'VOIDED'
  | 'FAILED'
  | 'UNAVAILABLE';

export type ShipmentMetadata = {
  marketplaceSync?: {
    state?: string;
    status?: number;
    body?: string;
    failedAt?: string;
    queuedAt?: string;
    syncedAt?: string;
    recoverable?: boolean;
    message?: string;
  };
  lastError?: {
    stage?: string;
    message?: string;
    recordedAt?: string;
    recoverable?: boolean;
    details?: string;
  } | null;
  purchase?: {
    state?: string;
    requestedAt?: string;
    purchasedAt?: string;
    failedAt?: string;
    recoverable?: boolean;
    message?: string;
  };
  void?: {
    state?: string;
    failedAt?: string;
    voidedAt?: string;
    message?: string;
  };
  providerResponse?: {
    shipmentId?: string;
    fees?: unknown[];
    messages?: unknown[];
  };
};

export type Shipment = {
  id: string;
  orderId: string;
  provider: string;
  status: ShipmentStatus;
  providerShipmentId: string | null;
  providerRateId: string | null;
  providerTrackerId: string | null;
  carrier: string | null;
  service: string | null;
  trackingCode: string | null;
  trackingStatus: string | null;
  labelUrl: string | null;
  labelFormat: string | null;
  rateAmount: string | number | null;
  rateCurrency: string | null;
  parcelLength: string | number | null;
  parcelWidth: string | number | null;
  parcelHeight: string | number | null;
  parcelWeightOz: string | number | null;
  metadata: ShipmentMetadata | null;
  purchasedAt: string | null;
  syncedToMarketplaceAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workflow: {
    status: ShipmentExecutionState;
    message: string;
    canVoid: boolean;
  };
};

export type OrderItem = {
  id: string;
  quantity: number;
  salePriceCents: number;
  marketplaceLineItemId: string | null;
  inventoryItem: {
    id: string;
    sku: string;
    title: string | null;
  } | null;
  listing: {
    id: string;
    marketplaceItemId: string | null;
    listingUrl?: string | null;
  } | null;
};

export type Order = {
  id: string;
  marketplace: string;
  marketplaceOrderId: string;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  shippingName: string | null;
  shippingCompany: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  totalCents: number;
  shippingCents: number;
  taxCents: number;
  feeCents: number;
  createdAt: string;
  updatedAt: string;
  marketplaceAccount: {
    id: string;
    kind: string;
    nickname: string | null;
  } | null;
  items: OrderItem[];
  shipments: Shipment[];
  fulfillment: {
    provider: string;
    providerConfigured: boolean;
    defaultShipFromConfigured: boolean;
    canRequestRates: boolean;
    canPurchaseLabels: boolean;
    status: ShipmentExecutionState;
    message: string;
    latestShipmentState: {
      status: ShipmentExecutionState;
      message: string;
      canVoid: boolean;
    };
  };
};

export type ShippingRate = {
  rateId: string;
  provider: string;
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  deliveryDays: number | null;
  deliveryDateGuaranteed: boolean | null;
  estDeliveryDate: string | null;
};

export type ShippingRateResponse = {
  provider: string;
  providerShipmentId: string;
  orderId: string;
  rates: ShippingRate[];
};

export function formatMoney(amount: number | string | null | undefined, currency = 'USD') {
  const value = typeof amount === 'string' ? Number(amount) : amount;

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatCents(amount: number) {
  return formatMoney(amount / 100);
}

export function formatShipmentStatus(status: ShipmentStatus) {
  switch (status) {
    case 'LABEL_PURCHASED':
      return 'Label purchased';
    case 'SYNC_QUEUED':
      return 'Sync queued';
    case 'SYNCED_TO_MARKETPLACE':
      return 'Marketplace synced';
    default:
      return status.toLowerCase().replace(/_/g, ' ');
  }
}

export function formatExecutionState(status: ShipmentExecutionState) {
  switch (status) {
    case 'PURCHASE_REQUESTED':
      return 'Purchase requested';
    case 'LABEL_PURCHASED':
      return 'Label purchased';
    case 'SYNC_QUEUED':
      return 'Sync queued';
    case 'FULFILLED':
      return 'Fulfilled';
    case 'UNAVAILABLE':
      return 'Unavailable';
    default:
      return status.toLowerCase().replace(/_/g, ' ');
  }
}

export function getLatestShipment(order: Order) {
  return order.shipments[0] ?? null;
}

export function getSyncState(shipment: Shipment | null) {
  return shipment?.metadata?.marketplaceSync?.state ?? 'NOT_STARTED';
}

export function getShipmentLastError(shipment: Shipment | null) {
  return shipment?.metadata?.lastError ?? null;
}
