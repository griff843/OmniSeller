import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ListingsService } from './listings.service';

const add = jest.fn();

function publishableDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Draft title',
    description: 'Draft description',
    category: 'Cameras',
    priceCents: 19900,
    itemSpecifics: {
      Brand: 'Canon',
    },
    metadata: {
      ebay: {
        categoryId: '31388',
        requiredAspects: ['Brand'],
      },
    },
    ...overrides,
  };
}

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
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      photos: [],
      listingDraft: publishableDraft(),
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

    await expect(service.enqueuePublish('item_1', 'ebay', 'dev-user')).rejects.toBeInstanceOf(BadRequestException);
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
      listingDraft: publishableDraft(),
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

    await expect(service.enqueuePublish('item_1', 'ebay', 'dev-user')).rejects.toBeInstanceOf(
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
      listingDraft: publishableDraft(),
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

    const result = (await service.enqueuePublish('item_1', 'ebay', 'dev-user')) as { status: string };

    expect(add).toHaveBeenCalledWith('publish', { inventoryItemId: 'item_1', marketplace: 'ebay' });
    expect(result.status).toBe('QUEUED');
  });

  it('bulk queues publish requests with per-item results', async () => {
    const enqueueSpy = jest
      .spyOn(service, 'enqueuePublish')
      .mockResolvedValueOnce({
        status: 'QUEUED',
        message: 'Publish was queued for eBay.',
        publishState: {
          status: 'QUEUED',
          marketplace: 'ebay',
          requestedAt: null,
          queuedAt: null,
          startedAt: null,
          publishedAt: null,
          failedAt: null,
          error: null,
          message: 'Publish was queued for eBay.',
        },
      })
      .mockRejectedValueOnce(new BadRequestException('Complete draft eBay category ID before publish.'));

    const result = (await service.bulkEnqueuePublish(['item_1', 'item_2'], 'ebay', 'dev-user')) as {
      counts: { queued: number; failed: number };
      results: Array<{ itemId: string; status: string; message?: string }>;
    };

    expect(enqueueSpy).toHaveBeenCalledWith('item_1', 'ebay', 'dev-user');
    expect(enqueueSpy).toHaveBeenCalledWith('item_2', 'ebay', 'dev-user');
    expect(result.counts).toEqual({ queued: 1, failed: 1 });
    expect(result.results).toEqual([
      { itemId: 'item_1', status: 'queued', message: 'Publish was queued for eBay.' },
      { itemId: 'item_2', status: 'failed', message: 'Complete draft eBay category ID before publish.' },
    ]);

    enqueueSpy.mockRestore();
  });

  it('rejects invalid bulk publish batches before queueing', async () => {
    await expect(service.bulkEnqueuePublish([], 'ebay', 'dev-user')).rejects.toThrow(
      'Bulk workflow requires at least one inventory item id',
    );
    await expect(service.bulkEnqueuePublish(['item_1', 'item_1'], 'ebay', 'dev-user')).rejects.toThrow(
      'Bulk workflow itemIds must be unique',
    );
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
      listingDraft: publishableDraft(),
      listings: [],
    });

    await expect(service.enqueuePublish('item_1', 'ebay', 'dev-user')).rejects.toBeInstanceOf(ConflictException);
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects publish when the draft only has free-text category without eBay taxonomy metadata', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item_1',
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      photos: [{ uploadStatus: 'READY', url: 'https://cdn.test/photo.jpg' }],
      listingDraft: publishableDraft({ metadata: {} }),
      listings: [],
    });
    prisma.inventoryItem.update.mockResolvedValue({
      publishStatus: 'BLOCKED',
      publishMarketplace: 'ebay',
      publishRequestedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishFailedAt: new Date('2026-03-12T15:00:00.000Z'),
      publishError: 'Complete draft eBay category ID before publish.',
    });

    await expect(service.enqueuePublish('item_1', 'ebay', 'dev-user')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishStatus: 'BLOCKED',
          publishError: 'Complete draft eBay category ID before publish.',
        }),
      }),
    );
    expect(add).not.toHaveBeenCalled();
  });

  it('throws not found when the inventory item does not exist', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null);

    await expect(service.enqueuePublish('missing', 'ebay', 'dev-user')).rejects.toBeInstanceOf(NotFoundException);
  });
});
