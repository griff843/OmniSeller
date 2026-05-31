import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { ShipmentStatus, prisma } from '@omniseller/db';
import { EbayFulfillmentSyncService } from './ebay-fulfillment-sync.service';

jest.mock('node-fetch', () => jest.fn());
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
    shipment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    marketplaceAccount: {
      update: jest.fn(),
    },
  },
}));

describe('EbayFulfillmentSyncService', () => {
  const configService = {
    get: jest.fn(() => 'https://api.sandbox.ebay.test'),
  } as unknown as ConfigService;
  const ebayTokenService = {
    getValidAccessToken: jest.fn().mockResolvedValue('token_1'),
  };

  const service = new EbayFulfillmentSyncService(configService, ebayTokenService as any);
  const mockedFetch = fetch as unknown as jest.Mock;
  const mockedPrisma: any = prisma;

  beforeEach(() => {
    jest.clearAllMocks();
    ebayTokenService.getValidAccessToken.mockResolvedValue('token_1');
  });

  it('leaves a recoverable purchased shipment state when eBay sync fails', async () => {
    mockedPrisma.shipment.findUnique.mockResolvedValue({
      id: 'shipment_1',
      orderId: 'ord_1',
      trackingCode: '9400100000000000000000',
      carrier: 'USPS',
      metadata: null,
      order: {
        marketplaceOrderId: 'ebay-order-1',
        marketplaceAccount: {
          id: 'acct_1',
          kind: 'ebay',
          accessToken: 'token_1',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          refreshToken: 'refresh_1',
        },
        items: [
          {
            quantity: 1,
            marketplaceLineItemId: 'line_1',
            listing: null,
          },
        ],
      },
    } as any);
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('sync exploded'),
    });
    mockedPrisma.shipment.update.mockResolvedValue({} as any);

    await expect(service.syncTrackingForShipment('shipment_1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(mockedPrisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shipment_1' },
        data: expect.objectContaining({
          status: ShipmentStatus.LABEL_PURCHASED,
          metadata: expect.objectContaining({
            marketplaceSync: expect.objectContaining({
              state: 'FAILED',
              recoverable: true,
            }),
            lastError: expect.objectContaining({
              stage: 'marketplace-sync',
              recoverable: true,
            }),
          }),
        }),
      }),
    );
  });

  it('marks the shipment synced when eBay accepts fulfillment tracking', async () => {
    mockedPrisma.shipment.findUnique.mockResolvedValue({
      id: 'shipment_1',
      orderId: 'ord_1',
      trackingCode: '9400100000000000000000',
      carrier: 'USPS',
      metadata: null,
      order: {
        marketplaceOrderId: 'ebay-order-1',
        marketplaceAccount: {
          id: 'acct_1',
          kind: 'ebay',
          accessToken: 'token_1',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          refreshToken: 'refresh_1',
        },
        items: [
          {
            quantity: 1,
            marketplaceLineItemId: 'line_1',
            listing: null,
          },
        ],
      },
    } as any);
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 204,
      text: jest.fn(),
    });

    await service.syncTrackingForShipment('shipment_1');

    expect(mockedPrisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shipment_1' },
        data: expect.objectContaining({
          status: ShipmentStatus.SYNCED_TO_MARKETPLACE,
          metadata: expect.objectContaining({
            marketplaceSync: expect.objectContaining({ state: 'SYNCED' }),
          }),
        }),
      }),
    );
  });
});
