import { calculateProfitSummary, DashboardService } from './dashboard.service';

jest.mock('@omniseller/db', () => ({
  prisma: {
    inventoryItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    listing: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('DashboardService', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const service = new DashboardService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates full-settlement revenue and actual label costs', () => {
    const summary = calculateProfitSummary([
      {
        totalCents: 6000,
        feeCents: 600,
        shippingCents: 1000,
        taxCents: 0,
        items: [
          {
            quantity: 2,
            salePriceCents: 2500,
            inventoryItem: { costBasisCents: 1000 },
          },
        ],
        shipments: [{ status: 'LABEL_PURCHASED', rateAmount: '4.00' }],
      },
    ]);

    expect(summary).toEqual({
      revenueCents: 6000,
      feeCents: 600,
      shippingCostCents: 400,
      costBasisCents: 2000,
      grossProfitCents: 3000,
      roiPercent: 150,
    });
  });

  it('uses item-only revenue fallback that excludes buyer shipping and tax before adding shipping revenue', () => {
    const summary = calculateProfitSummary([
      {
        totalCents: 6700,
        feeCents: 700,
        shippingCents: 1000,
        taxCents: 700,
        items: [],
        shipments: [{ status: 'LABEL_PURCHASED', rateAmount: '4.00' }],
      },
    ]);

    expect(summary.revenueCents).toBe(6000);
    expect(summary.shippingCostCents).toBe(400);
    expect(summary.grossProfitCents).toBe(4900);
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
    prisma.inventoryItem.count.mockResolvedValue(2);
    prisma.inventoryItem.aggregate.mockResolvedValue({ _sum: { costBasisCents: 4200 } });
    prisma.inventoryItem.groupBy
      .mockResolvedValueOnce([
        { listingReadiness: 'NEEDS_PHOTOS', _count: { _all: 1 } },
        { listingReadiness: 'READY_TO_PUBLISH', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { saleStatus: 'AVAILABLE', _count: { _all: 1 } },
        { saleStatus: 'LISTED', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { publishStatus: 'NOT_REQUESTED', _count: { _all: 1 } },
        { publishStatus: 'FAILED', _count: { _all: 1 } },
      ]);
    prisma.listing.findMany.mockResolvedValue([
      { id: 'listing_1', status: 'active', priceCents: 7500 },
      { id: 'listing_2', status: 'ended', priceCents: 5000 },
    ]);
    prisma.listing.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prisma.listing.aggregate.mockResolvedValue({ _sum: { priceCents: 7500 } });
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
        taxCents: 0,
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
        shipments: [{ status: 'ERROR', rateAmount: '3.00' }],
      },
    ]);
    prisma.order.count.mockResolvedValue(1);

    const summary = (await service.getSummary('user_1')) as any;

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user_1' }, take: 200 }),
    );
    expect(prisma.inventoryItem.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user_1',
          binId: null,
          inventoryStatus: { not: 'ARCHIVED' },
          saleStatus: { notIn: ['SOLD', 'SHIPPED'] },
        },
      }),
    );
    expect(summary.inventory.total).toBe(2);
    expect(summary.inventory.workflow.blocked).toBe(1);
    expect(summary.listings.active).toBe(1);
    expect(summary.orders.requiringShipping).toBe(1);
    expect(summary.profit).toEqual(
      expect.objectContaining({
        revenueCents: 8000,
        shippingCostCents: 300,
        grossProfitCents: 3800,
      }),
    );
    expect(summary.period.orderWindowDays).toBe(30);
    expect(summary.inventory.intake).toEqual({
      recentDays: 7,
      recentCreated: 2,
      missingCostBasis: 2,
      unassignedBin: 2,
      staleDraftDays: 14,
      staleDraft: 2,
    });
    expect(summary.workQueues.needsPhotos).toHaveLength(1);
    expect(summary.workQueues.publishBlocked[0].publishError).toContain('category');
    expect(summary.workQueues.shippingError).toHaveLength(1);
  });
});
