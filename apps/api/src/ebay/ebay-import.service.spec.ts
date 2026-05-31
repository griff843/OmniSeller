import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EbayImportProvider } from './ebay-import.provider';
import { EbayImportService } from './ebay-import.service';

jest.mock('@omniseller/db', () => ({
  prisma: {
    marketplaceAccount: {
      findFirst: jest.fn(),
    },
    marketplaceSyncState: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    listing: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryItem: {
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('EbayImportService', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const provider: jest.Mocked<EbayImportProvider> = {
    fetchSnapshot: jest.fn(),
  } as any;
  const service = new EbayImportService(provider);
  const account = {
    id: 'acct_1',
    userId: 'user_1',
    kind: 'ebay',
    siteId: 'EBAY-US',
    nickname: 'Store',
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.marketplaceAccount.findFirst.mockResolvedValue(account);
    prisma.marketplaceSyncState.upsert.mockResolvedValue({});
  });

  it('rejects sync when no eBay account is connected', async () => {
    prisma.marketplaceAccount.findFirst.mockResolvedValue(null);

    await expect(service.sync('ALL', 'user_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects unknown sync resources', async () => {
    await expect(service.sync('BAD' as any, 'user_1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('imports active listings into placeholder inventory and listings idempotently', async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    prisma.inventoryItem.create.mockResolvedValue({ id: 'item_1' });
    prisma.listing.create.mockResolvedValue({ id: 'listing_1' });

    const results = await service.importSnapshot(account as any, {
      listings: [
        {
          marketplaceItemId: '123-ABC',
          offerId: 'offer_1',
          listingUrl: 'https://www.ebay.com/itm/123-ABC',
          title: 'Vintage denim jacket',
          description: 'Imported description',
          category: 'Coats & Jackets',
          priceCents: 4200,
          quantity: 1,
          status: 'active',
          publishedAt: '2026-05-30T12:00:00.000Z',
        },
      ],
    });

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        sku: 'EBAY-ACCT1-123ABC',
        listingReadiness: 'LISTED',
        saleStatus: 'LISTED',
        publishStatus: 'PUBLISHED',
      }),
    });
    expect(prisma.listing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryItemId: 'item_1',
        marketplaceAccountId: 'acct_1',
        marketplaceItemId: '123-ABC',
        status: 'active',
        priceCents: 4200,
      }),
    });
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: expect.objectContaining({
        saleStatus: 'LISTED',
        publishStatus: 'PUBLISHED',
      }),
    });
    expect(results[0]).toEqual(
      expect.objectContaining({
        resource: 'LISTINGS',
        imported: 1,
        created: 1,
        updated: 0,
      }),
    );
  });

  it('upserts imported orders and marks linked inventory sold', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    prisma.order.create.mockResolvedValue({ id: 'order_1' });
    prisma.listing.findFirst.mockResolvedValue({
      id: 'listing_1',
      inventoryItemId: 'item_1',
      inventoryItem: { id: 'item_1' },
    });
    prisma.orderItem.findFirst.mockResolvedValue(null);

    await service.importSnapshot(account as any, {
      orders: [
        {
          marketplaceOrderId: 'ORDER-1',
          buyerName: 'Buyer',
          totalCents: 5000,
          feeCents: 650,
          shippingCents: 800,
          taxCents: 0,
          items: [
            {
              marketplaceLineItemId: 'LINE-1',
              marketplaceItemId: '123-ABC',
              quantity: 1,
              salePriceCents: 5000,
            },
          ],
        },
      ],
    });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        marketplace: 'ebay',
        marketplaceOrderId: 'ORDER-1',
        marketplaceAccountId: 'acct_1',
        totalCents: 5000,
      }),
    });
    expect(prisma.orderItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order_1',
        listingId: 'listing_1',
        inventoryItemId: 'item_1',
        marketplaceLineItemId: 'LINE-1',
      }),
    });
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: expect.objectContaining({
        saleStatus: 'SOLD',
        publishStatus: 'PUBLISHED',
      }),
    });
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing_1' },
      data: { status: 'sold' },
    });
  });

  it('records sync status around provider-backed manual syncs', async () => {
    provider.fetchSnapshot.mockResolvedValue({
      listings: [],
      orders: [],
      cursors: {
        LISTINGS: 'next-listings',
        ORDERS: 'next-orders',
      },
    });

    const result = await service.sync('ALL', 'user_1');

    expect(provider.fetchSnapshot).toHaveBeenCalledWith(account);
    expect(prisma.marketplaceSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          marketplaceAccountId: 'acct_1',
          resource: 'LISTINGS',
          status: 'RUNNING',
        }),
      }),
    );
    expect(prisma.marketplaceSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: 'COMPLETED',
          cursor: 'next-orders',
        }),
      }),
    );
    expect(result.resources).toHaveLength(2);
  });
});
