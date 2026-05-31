import { calculateProfitSummary, DashboardService } from './dashboard.service';

jest.mock('@omniseller/db', () => ({
  prisma: {
    inventoryItem: {
      findMany: jest.fn(),
    },
    listing: {
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
  },
}));

describe('DashboardService', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const service = new DashboardService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates revenue, cost basis, gross profit, and ROI from order items', () => {
    const summary = calculateProfitSummary([
      {
        totalCents: 5000,
        feeCents: 600,
        shippingCents: 800,
        items: [
          {
            quantity: 2,
            salePriceCents: 2500,
            inventoryItem: { costBasisCents: 1000 },
          },
        ],
      },
    ]);

    expect(summary).toEqual({
      revenueCents: 5000,
      feeCents: 600,
      shippingCostCents: 800,
      costBasisCents: 2000,
      grossProfitCents: 1600,
      roiPercent: 80,
    });
  });

  it('returns user-scoped operating counts and queues', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item_1',
        sku: 'SKU-1',
        title: 'Needs photos',
        inventoryStatus: 'IN_STOCK',
        listingReadiness: 'NEEDS_PHOTOS',
        saleStatus: 'AVAILABLE',
        publishStatus: 'NOT_REQUESTED',
        publishError: null,
        costBasisCents: 1200,
        updatedAt: new Date('2026-03-12T10:00:00.000Z'),
      },
      {
        id: 'item_2',
        sku: 'SKU-2',
        title: 'Failed publish',
        inventoryStatus: 'IN_STOCK',
        listingReadiness: 'READY_TO_PUBLISH',
        saleStatus: 'LISTED',
        publishStatus: 'FAILED',
        publishError: 'Marketplace rejected category',
        costBasisCents: 3000,
        updatedAt: new Date('2026-03-12T11:00:00.000Z'),
      },
    ]);
    prisma.listing.findMany.mockResolvedValue([
      { id: 'listing_1', status: 'active', priceCents: 7500 },
      { id: 'listing_2', status: 'ended', priceCents: 5000 },
    ]);
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order_1',
        marketplace: 'ebay',
        marketplaceOrderId: 'ORDER-1',
        buyerName: 'Buyer',
        shippingName: 'Buyer',
        totalCents: 7500,
        feeCents: 900,
        shippingCents: 500,
        createdAt: new Date('2026-03-12T12:00:00.000Z'),
        marketplaceAccount: { id: 'acct_1', kind: 'ebay', nickname: 'Store' },
        items: [
          {
            quantity: 1,
            salePriceCents: 7500,
            inventoryItem: {
              id: 'item_2',
              sku: 'SKU-2',
              title: 'Failed publish',
              costBasisCents: 3000,
            },
          },
        ],
        shipments: [{ status: 'ERROR' }],
      },
    ]);

    const summary = (await service.getSummary('user_1')) as any;

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user_1' } }),
    );
    expect(summary.inventory.total).toBe(2);
    expect(summary.inventory.workflow.blocked).toBe(1);
    expect(summary.listings.active).toBe(1);
    expect(summary.orders.requiringShipping).toBe(1);
    expect(summary.profit.grossProfitCents).toBe(3100);
    expect(summary.workQueues.needsPhotos).toHaveLength(1);
    expect(summary.workQueues.publishBlocked[0].publishError).toContain('category');
    expect(summary.workQueues.shippingError).toHaveLength(1);
  });
});
