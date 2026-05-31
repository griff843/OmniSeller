import { OrdersService } from './orders.service';

jest.mock('@omniseller/db', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('OrdersService', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const shippingService = {
    getAvailabilitySummary: jest.fn(),
  };
  const service = new OrdersService(shippingService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes unfulfilled orders as unavailable when shipping is not configured', async () => {
    shippingService.getAvailabilitySummary.mockReturnValue({
      provider: 'easypost',
      providerConfigured: false,
      defaultShipFromConfigured: false,
      canRequestRates: false,
      canPurchaseLabels: false,
      blockedReason:
        'Shipping is unavailable in this environment. Set EASYPOST_API_KEY to enable rates and label purchase.',
    });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order_1',
        marketplace: 'ebay',
        marketplaceOrderId: 'ORDER-1',
        buyerName: 'Buyer',
        buyerPhone: null,
        buyerEmail: null,
        shippingName: 'Buyer',
        shippingCompany: null,
        shippingAddress1: '123 Main',
        shippingAddress2: null,
        shippingCity: 'Austin',
        shippingState: 'TX',
        shippingPostalCode: '78701',
        shippingCountry: 'US',
        totalCents: 1000,
        shippingCents: 100,
        taxCents: 0,
        feeCents: 100,
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
        updatedAt: new Date('2026-03-12T10:00:00.000Z'),
        marketplaceAccount: { id: 'acct_1', userId: 'dev-user', kind: 'ebay', nickname: 'Test' },
        items: [],
        shipments: [],
      },
    ]);

    const result = (await service.list('dev-user')) as any[];

    expect(result[0].fulfillment.status).toBe('UNAVAILABLE');
    expect(result[0].fulfillment.message).toContain('EASYPOST_API_KEY');
  });

  it('serializes shipment errors as unavailable when carrier config is missing', async () => {
    shippingService.getAvailabilitySummary.mockReturnValue({
      provider: 'easypost',
      providerConfigured: false,
      defaultShipFromConfigured: false,
      canRequestRates: false,
      canPurchaseLabels: false,
      blockedReason:
        'Shipping is unavailable in this environment. Set EASYPOST_API_KEY to enable rates and label purchase.',
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order_1',
      marketplace: 'ebay',
      marketplaceOrderId: 'ORDER-1',
      buyerName: 'Buyer',
      buyerPhone: null,
      buyerEmail: null,
      shippingName: 'Buyer',
      shippingCompany: null,
      shippingAddress1: '123 Main',
      shippingAddress2: null,
      shippingCity: 'Austin',
      shippingState: 'TX',
      shippingPostalCode: '78701',
      shippingCountry: 'US',
      totalCents: 1000,
      shippingCents: 100,
      taxCents: 0,
      feeCents: 100,
      createdAt: new Date('2026-03-12T10:00:00.000Z'),
      updatedAt: new Date('2026-03-12T10:00:00.000Z'),
      marketplaceAccount: { id: 'acct_1', userId: 'dev-user', kind: 'ebay', nickname: 'Test' },
      items: [],
      shipments: [
        {
          id: 'shipment_1',
          orderId: 'order_1',
          provider: 'easypost',
          status: 'ERROR',
          providerShipmentId: 'shp_1',
          providerRateId: 'rate_1',
          providerTrackerId: null,
          carrier: null,
          service: null,
          trackingCode: null,
          trackingStatus: null,
          labelUrl: null,
          labelFormat: null,
          rateAmount: null,
          rateCurrency: null,
          parcelLength: null,
          parcelWidth: null,
          parcelHeight: null,
          parcelWeightOz: null,
          purchasedAt: null,
          syncedToMarketplaceAt: null,
          voidedAt: null,
          createdAt: new Date('2026-03-12T10:05:00.000Z'),
          updatedAt: new Date('2026-03-12T10:05:00.000Z'),
          metadata: {
            purchase: { state: 'UNAVAILABLE' },
            lastError: {
              message:
                'Shipping is not configured. Set EASYPOST_API_KEY to enable shipping endpoints.',
            },
          },
        },
      ],
    });

    const result = (await service.get('order_1', 'dev-user')) as any;

    expect(result.fulfillment.status).toBe('UNAVAILABLE');
    expect(result.shipments[0].workflow.status).toBe('UNAVAILABLE');
  });
});
