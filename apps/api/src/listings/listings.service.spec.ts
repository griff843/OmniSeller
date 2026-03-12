import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ListingsService } from './listings.service';

const add = jest.fn();

jest.mock('@omniseller/db', () => ({
  prisma: {
    inventoryItem: {
      findUnique: jest.fn(),
    },
  },
}));

describe('ListingsService', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const service = new ListingsService({ add } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects publish when the item is not ready', async () => {
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

    await expect(service.enqueuePublish('item_1', 'ebay')).rejects.toBeInstanceOf(BadRequestException);
    expect(add).not.toHaveBeenCalled();
  });

  it('queues publish when the item is ready', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item_1',
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

    await service.enqueuePublish('item_1', 'ebay');

    expect(add).toHaveBeenCalledWith('publish', { inventoryItemId: 'item_1', marketplace: 'ebay' });
  });

  it('throws not found when the inventory item does not exist', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null);

    await expect(service.enqueuePublish('missing', 'ebay')).rejects.toBeInstanceOf(NotFoundException);
  });
});
