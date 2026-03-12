import { PublishProcessor } from './publish.processor';

jest.mock('@omniseller/db', () => ({
  prisma: {
    inventoryItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    marketplaceAccount: {
      findFirst: jest.fn(),
    },
    listing: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('PublishProcessor', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const publishProvider = {
    getAvailability: jest.fn(),
    publishDraft: jest.fn(),
  };
  const processor = new PublishProcessor(publishProvider as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks publish as unavailable when no marketplace account is connected', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValueOnce({
      id: 'item_1',
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      photos: [{ uploadStatus: 'READY', url: 'https://cdn.test/photo.jpg' }],
      listingDraft: {
        title: 'Draft title',
        description: 'Draft description',
        category: 'Cameras',
        priceCents: 19900,
      },
      listings: [],
    });
    prisma.marketplaceAccount.findFirst.mockResolvedValue(null);
    publishProvider.getAvailability.mockReturnValue({
      available: false,
      reason: 'Connect an eBay marketplace account before publishing.',
    });

    await processor.process({
      data: {
        inventoryItemId: 'item_1',
        marketplace: 'ebay',
      },
    } as any);

    expect(prisma.inventoryItem.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          publishStatus: 'PROCESSING',
        }),
      }),
    );
    expect(prisma.inventoryItem.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          publishStatus: 'UNAVAILABLE',
          publishError: 'Connect an eBay marketplace account before publishing.',
        }),
      }),
    );
  });

  it('marks publish as failed when the provider throws', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValueOnce({
      id: 'item_1',
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      photos: [{ uploadStatus: 'READY', url: 'https://cdn.test/photo.jpg' }],
      listingDraft: {
        title: 'Draft title',
        description: 'Draft description',
        category: 'Cameras',
        priceCents: 19900,
      },
      listings: [],
    });
    prisma.marketplaceAccount.findFirst.mockResolvedValue({
      id: 'acct_1',
      kind: 'ebay',
      accessToken: 'token',
      refreshToken: 'refresh',
    });
    publishProvider.getAvailability.mockReturnValue({
      available: true,
      marketplaceAccount: {
        id: 'acct_1',
        kind: 'ebay',
        accessToken: 'token',
        refreshToken: 'refresh',
      },
    });
    publishProvider.publishDraft.mockRejectedValue(
      new Error('eBay publish transport is not configured for this local environment yet.'),
    );

    await processor.process({
      data: {
        inventoryItemId: 'item_1',
        marketplace: 'ebay',
      },
    } as any);

    expect(prisma.inventoryItem.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          publishStatus: 'FAILED',
        }),
      }),
    );
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });
});
