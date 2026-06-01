export type DashboardCountBucket = {
  key: string;
  count: number;
};

export type DashboardInventoryPreview = {
  id: string;
  sku: string;
  title: string | null;
  listingReadiness: string;
  saleStatus: string;
  publishStatus: string;
  publishError: string | null;
  updatedAt: string;
};

export type DashboardOrderPreview = {
  id: string;
  marketplace: string;
  marketplaceOrderId: string;
  buyerName: string | null;
  totalCents: number;
  feeCents: number;
  shippingCents: number;
  createdAt: string;
  marketplaceAccount: {
    id: string;
    kind: string;
    nickname: string | null;
  } | null;
  itemCount: number;
  firstSku: string | null;
  latestShipmentStatus: string | null;
};

export type DashboardSummary = {
  generatedAt: string;
  period: {
    orderWindowDays: number;
    orderWindowStart: string;
  };
  inventory: {
    total: number;
    valueCents: number;
    readiness: DashboardCountBucket[];
    saleLifecycle: DashboardCountBucket[];
    workflow: {
      listed: number;
      sold: number;
      shipped: number;
      blocked: number;
    };
    intake: {
      recentDays: number;
      recentCreated: number;
      missingCostBasis: number;
      unassignedBin: number;
      staleDraftDays: number;
      staleDraft: number;
    };
  };
  listings: {
    total: number;
    active: number;
    activeValueCents: number;
  };
  orders: {
    total: number;
    requiringShipping: number;
    recentSales: DashboardOrderPreview[];
    shippingQueue: DashboardOrderPreview[];
  };
  profit: {
    revenueCents: number;
    feeCents: number;
    shippingCostCents: number;
    costBasisCents: number;
    grossProfitCents: number;
    roiPercent: number | null;
  };
  workQueues: {
    needsPhotos: DashboardInventoryPreview[];
    readyForAi: DashboardInventoryPreview[];
    readyToPublish: DashboardInventoryPreview[];
    publishBlocked: DashboardInventoryPreview[];
    shippingError: DashboardOrderPreview[];
  };
};

export function formatDashboardLabel(value: string) {
  return value.toLowerCase().replace(/_/g, ' ');
}
