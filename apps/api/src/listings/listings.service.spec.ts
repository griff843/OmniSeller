import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ListingsService } from './listings.service';

const add = jest.fn();

jest.mock('@omniseller/db', () => ({
  prisma: {
    inventoryItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    marketplaceAccount: {
      findFirst: jest.fn(),
    },
  },
}));

describe('ListingsService', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const publishProvider = {
    getAvailability: jest.fn(),
  };
  const service = new ListingsService({ add } as any, publishProvider as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects publish when the item is not ready and persists a blocked state', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item_1',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      photos: [],
      listingDraft: {
        title: 'Draft title',
        description: 'Draft description',
        category: 'Cameras',
        priceCents: 19900,
      },
      listings: [],
    });
    prisma.inventoryItem.update.mockResolvedValue({
      publishStatus: 'BLOCKED',
      publishMarketplace: 'ebay',
      publishRequestedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishQueuedAt: null,
      publishStartedAt: null,
      publishedAt: null,
      publishFailedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishError: 'Upload at least one ready photo to unlock AI and listing workflows.',
    });

    await expect(service.enqueuePublish('item_1', 'ebay')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishStatus: 'BLOCKED',
        }),
      }),
    );
    expect(add).not.toHaveBeenCalled();
  });

  it('marks publish as unavailable when marketplace credentials are missing', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item_1',
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      publishStatus: 'NOT_REQUESTED',
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
    prisma.inventoryItem.update.mockResolvedValue({
      publishStatus: 'UNAVAILABLE',
      publishMarketplace: 'ebay',
      publishRequestedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishQueuedAt: null,
      publishStartedAt: null,
      publishedAt: null,
      publishFailedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishError: 'Connect an eBay marketplace account before publishing.',
    });

    await expect(service.enqueuePublish('item_1', 'ebay')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(add).not.toHaveBeenCalled();
  });

  it('queues publish when the item is ready and marketplace is available', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item_1',
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      publishStatus: 'NOT_REQUESTED',
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
    prisma.inventoryItem.update.mockResolvedValue({
      publishStatus: 'QUEUED',
      publishMarketplace: 'ebay',
      publishRequestedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishQueuedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishStartedAt: null,
      publishedAt: null,
      publishFailedAt: null,
      publishError: null,
    });

    const result = (await service.enqueuePublish('item_1', 'ebay')) as { status: string };

    expect(add).toHaveBeenCalledWith('publish', { inventoryItemId: 'item_1', marketplace: 'ebay' });
    expect(result.status).toBe('QUEUED');
  });

  it('prevents duplicate publish requests while a publish is already in flight', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item_1',
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      publishStatus: 'QUEUED',
      publishMarketplace: 'ebay',
      publishError: null,
      photos: [{ uploadStatus: 'READY', url: 'https://cdn.test/photo.jpg' }],
      listingDraft: {
        title: 'Draft title',
        description: 'Draft description',
        category: 'Cameras',
        priceCents: 19900,
      },
      listings: [],
    });

    await expect(service.enqueuePublish('item_1', 'ebay')).rejects.toBeInstanceOf(ConflictException);
    expect(add).not.toHaveBeenCalled();
  });

  it('throws not found when the inventory item does not exist', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null);

    await expect(service.enqueuePublish('missing', 'ebay')).rejects.toBeInstanceOf(NotFoundException);
  });
});
