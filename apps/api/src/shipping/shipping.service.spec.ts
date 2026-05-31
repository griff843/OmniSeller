import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ShipmentStatus, prisma } from '@omniseller/db';
import { ShippingService } from './shipping.service';

jest.mock('@omniseller/db', () => ({
  ShipmentStatus: {
    PENDING: 'PENDING',
    LABEL_PURCHASED: 'LABEL_PURCHASED',
    SYNC_QUEUED: 'SYNC_QUEUED',
    SYNCED_TO_MARKETPLACE: 'SYNCED_TO_MARKETPLACE',
    VOIDED: 'VOIDED',
    ERROR: 'ERROR',
  },
  Prisma: {},
  prisma: {
    order: {
      findUnique: jest.fn(),
    },
    shipment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('ShippingService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        DEFAULT_SHIP_FROM_STREET1: '100 Warehouse Way',
        DEFAULT_SHIP_FROM_CITY: 'Columbus',
        DEFAULT_SHIP_FROM_STATE: 'OH',
        DEFAULT_SHIP_FROM_ZIP: '43004',
        DEFAULT_SHIP_FROM_COUNTRY: 'US',
      };

      return values[key];
    }),
  } as unknown as ConfigService;

  const easyPostClient = {
    isConfigured: jest.fn(() => true),
    createShipment: jest.fn(),
    buyShipment: jest.fn(),
    refundShipment: jest.fn(),
  };

  const shippingSyncQueue = {
    add: jest.fn(),
  };

  const service = new ShippingService(
    configService,
    easyPostClient as any,
    shippingSyncQueue as any,
  );

  const mockedPrisma: any = prisma;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('quotes rates for a valid order', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      shippingName: 'Buyer Name',
      shippingAddress1: '200 Main St',
      shippingCity: 'Austin',
      shippingState: 'TX',
      shippingPostalCode: '78701',
      shippingCountry: 'US',
      buyerAddress: null,
      buyerName: 'Buyer Name',
      buyerPhone: null,
      buyerEmail: null,
      marketplaceAccount: { userId: 'dev-user' },
    } as any);

    easyPostClient.createShipment.mockResolvedValue({
      id: 'shp_provider_1',
      rates: [
        {
          id: 'rate_1',
          carrier: 'USPS',
          service: 'Priority',
          rate: '7.99',
          currency: 'USD',
          delivery_days: 2,
          delivery_date_guaranteed: false,
          est_delivery_date: '2026-03-14',
        },
      ],
    });

    const result = await service.previewRates(
      {
        orderId: 'ord_1',
        parcels: [{ length: 10, width: 8, height: 4, weightOz: 16 }],
      },
      'dev-user',
    );

    expect(easyPostClient.createShipment).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      providerShipmentId: 'shp_provider_1',
      orderId: 'ord_1',
      rates: [
        expect.objectContaining({
          rateId: 'rate_1',
          carrier: 'USPS',
          service: 'Priority',
        }),
      ],
    });
  });

  it('reports shipping as unavailable when EasyPost is not configured', async () => {
    const unavailableService = new ShippingService(
      configService,
      {
        ...easyPostClient,
        isConfigured: jest.fn(() => false),
      } as any,
      shippingSyncQueue as any,
    );

    await expect(
      unavailableService.previewRates(
        {
          orderId: 'ord_1',
          parcels: [{ length: 10, width: 8, height: 4, weightOz: 16 }],
        },
        'dev-user',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('purchases a label and enqueues marketplace sync for ebay orders', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'ord_ebay',
      marketplaceAccount: { kind: 'ebay', userId: 'dev-user' },
    } as any);
    mockedPrisma.shipment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockedPrisma.shipment.create.mockResolvedValue({
      id: 'shipment_pending',
      metadata: null,
      status: ShipmentStatus.PENDING,
    } as any);
    mockedPrisma.shipment.update.mockResolvedValueOnce({
      id: 'shipment_pending',
      metadata: null,
      status: ShipmentStatus.SYNC_QUEUED,
    } as any);

    easyPostClient.buyShipment.mockResolvedValue({
      id: 'shp_provider_1',
      selected_rate: {
        id: 'rate_1',
        carrier: 'USPS',
        service: 'Priority',
        rate: '7.99',
        currency: 'USD',
      },
      tracker: {
        id: 'trk_1',
        tracking_code: '9400100000000000000000',
        status: 'pre_transit',
      },
      postage_label: {
        label_pdf_url: 'https://labels.test/label.pdf',
      },
      parcel: {
        length: 10,
        width: 8,
        height: 4,
        weight: 16,
      },
      fees: [],
      messages: [],
    });

    const result = await service.purchaseLabel(
      {
        orderId: 'ord_ebay',
        providerShipmentId: 'shp_provider_1',
        rateId: 'rate_1',
        labelFormat: 'PDF',
      },
      'dev-user',
    );

    expect(mockedPrisma.shipment.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.shipment.update).toHaveBeenCalledTimes(1);
    expect(shippingSyncQueue.add).toHaveBeenCalledWith(
      'shipping-sync-ebay-fulfillment',
      { shipmentId: 'shipment_pending' },
      expect.objectContaining({ jobId: 'shipment-sync:shipment_pending' }),
    );
    expect(result).toMatchObject({ status: ShipmentStatus.SYNC_QUEUED });
  });

  it('does not repurchase a label when a purchased shipment already exists', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      marketplaceAccount: { kind: 'ebay', userId: 'dev-user' },
    } as any);
    mockedPrisma.shipment.findFirst.mockResolvedValue({
      id: 'shipment_existing',
      status: ShipmentStatus.SYNC_QUEUED,
    } as any);

    const result = await service.purchaseLabel(
      {
        orderId: 'ord_1',
        providerShipmentId: 'shp_provider_1',
        rateId: 'rate_1',
      },
      'dev-user',
    );

    expect(easyPostClient.buyShipment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'shipment_existing' });
  });

  it('marks shipment purchase as unavailable when carrier config is missing', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      marketplaceAccount: { kind: 'ebay', userId: 'dev-user' },
    } as any);
    mockedPrisma.shipment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockedPrisma.shipment.create.mockResolvedValue({
      id: 'shipment_pending',
      metadata: null,
      status: ShipmentStatus.PENDING,
    } as any);
    mockedPrisma.shipment.update.mockResolvedValue({
      id: 'shipment_pending',
      metadata: {
        purchase: {
          state: 'UNAVAILABLE',
        },
      },
      status: ShipmentStatus.ERROR,
    } as any);

    easyPostClient.buyShipment.mockRejectedValue(
      new ServiceUnavailableException(
        'Shipping is not configured. Set EASYPOST_API_KEY to enable shipping endpoints.',
      ),
    );

    await expect(
      service.purchaseLabel(
        {
          orderId: 'ord_1',
          providerShipmentId: 'shp_provider_1',
          rateId: 'rate_1',
        },
        'dev-user',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mockedPrisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ShipmentStatus.ERROR,
          metadata: expect.objectContaining({
            purchase: expect.objectContaining({
              state: 'UNAVAILABLE',
            }),
          }),
        }),
      }),
    );
  });

  it('returns shipments for an order', async () => {
    mockedPrisma.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      marketplaceAccount: { userId: 'dev-user' },
    } as any);
    mockedPrisma.shipment.findMany.mockResolvedValue([
      { id: 'shipment_1', orderId: 'ord_1' },
    ] as any);

    const result = await service.getShipmentsForOrder('ord_1', 'dev-user');

    expect(mockedPrisma.shipment.findMany).toHaveBeenCalledWith({
      where: { orderId: 'ord_1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'shipment_1', orderId: 'ord_1' }]);
  });

  it('voids a purchased shipment', async () => {
    mockedPrisma.shipment.findUnique.mockResolvedValue({
      id: 'shipment_1',
      providerShipmentId: 'shp_provider_1',
      status: ShipmentStatus.LABEL_PURCHASED,
      purchasedAt: new Date('2026-03-11T12:00:00.000Z'),
      metadata: null,
      order: {
        marketplaceAccount: { userId: 'dev-user' },
      },
    } as any);
    mockedPrisma.shipment.update.mockResolvedValue({
      id: 'shipment_1',
      status: ShipmentStatus.VOIDED,
    } as any);

    const result = await service.voidLabel('shipment_1', 'dev-user');

    expect(easyPostClient.refundShipment).toHaveBeenCalledWith('shp_provider_1');
    expect(result).toMatchObject({ status: ShipmentStatus.VOIDED });
  });
});
