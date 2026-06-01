import { ConfigService } from '@nestjs/config';
import { PhotoAssetRole, PhotoUploadStatus, prisma } from '@omniseller/db';
import { InventoryScannerService } from './inventory-scanner.service';
import { InventoryService } from './inventory.service';
import { PhotoProcessingService } from './photo-processing.service';
import { PhotoStoragePathService } from './photo-storage-path.service';

jest.mock('@omniseller/db', () => ({
  PhotoAssetRole: {
    ORIGINAL: 'ORIGINAL',
    PROCESSED: 'PROCESSED',
    THUMBNAIL: 'THUMBNAIL',
  },
  PhotoUploadStatus: {
    PENDING: 'PENDING',
    UPLOADING: 'UPLOADING',
    READY: 'READY',
    PROCESSING: 'PROCESSING',
    FAILED: 'FAILED',
    DELETED: 'DELETED',
  },
  Prisma: {},
  prisma: {
    $transaction: jest.fn(),
    user: {
      upsert: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    bin: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    photo: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('InventoryService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'STORAGE_BUCKET') return 'omniseller-images';
      return undefined;
    }),
  } as unknown as ConfigService;

  const service = new InventoryService(
    configService,
    new PhotoProcessingService(),
    new PhotoStoragePathService(),
    new InventoryScannerService(),
  );

  const mockedPrisma: any = prisma;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a deterministic SKU when a manual SKU is not provided', async () => {
    mockedPrisma.inventoryItem.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...data,
        bin: null,
        listingDraft: null,
        aiListingSuggestions: [],
        listings: [],
        photos: [],
        createdAt: new Date('2026-03-11T15:00:00.000Z'),
        updatedAt: new Date('2026-03-11T15:00:00.000Z'),
      }),
    );

    const result = (await service.create({ title: 'Vintage Camera' }, 'dev-user')) as { sku: string; skuManuallySet: boolean };

    expect(mockedPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dev-user' },
      }),
    );
    expect(result.sku).toMatch(/^INV-\d{8}-[A-Z0-9]{6}$/);
    expect(result.skuManuallySet).toBe(false);
  });

  it('creates deterministic upload reservations and makes the first photo primary', async () => {
    mockedPrisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item_1',
      sku: 'SKU 123',
      userId: 'dev-user',
      photos: [],
    });
    mockedPrisma.photo.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...data,
        createdAt: new Date('2026-03-11T15:00:00.000Z'),
        updatedAt: new Date('2026-03-11T15:00:00.000Z'),
      }),
    );
    mockedPrisma.$transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));

    const result = (await service.createPhotoUploadRequests('item_1', {
      files: [
        { fileName: 'front-view.jpg', contentType: 'image/jpeg', sizeBytes: 1024 },
        { fileName: 'back-view.png', contentType: 'image/png', sizeBytes: 2048 },
      ],
    }, 'dev-user')) as { uploads: Array<{ storageKey: string; isPrimary: boolean; uploadStatus: string; sort: number }> };

    expect(result.uploads).toHaveLength(2);
    expect(result.uploads[0].storageKey).toContain('inventory/sku-123/item_1/photos/');
    expect(result.uploads[0].storageKey).toContain('/original.jpg');
    expect(result.uploads[1].storageKey).toContain('/original.png');
    expect(result.uploads[0].isPrimary).toBe(true);
    expect(result.uploads[1].isPrimary).toBe(false);
    expect(result.uploads[0].uploadStatus).toBe(PhotoUploadStatus.PENDING);
    expect(result.uploads[1].sort).toBe(1);
  });

  it('assigns or creates a bin and normalizes scan fields on update', async () => {
    mockedPrisma.inventoryItem.findUnique
      .mockResolvedValueOnce({
        id: 'item_1',
        userId: 'dev-user',
        sku: 'INV-20260311-ABC123',
        skuManuallySet: false,
        title: 'Camera',
        description: null,
        category: null,
        condition: null,
        brand: null,
        model: null,
        upc: null,
        scanCode: null,
        inventoryStatus: 'DRAFT',
        listingReadiness: 'NEEDS_INTAKE',
        saleStatus: 'AVAILABLE',
        bin: null,
        photos: [],
        listingDraft: null,
        aiListingSuggestions: [],
        listings: [],
        createdAt: new Date('2026-03-11T15:00:00.000Z'),
        updatedAt: new Date('2026-03-11T15:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'item_1',
        title: 'Camera',
        condition: 'Used',
        saleStatus: 'AVAILABLE',
        photos: [],
        listingDraft: null,
        listings: [],
        aiListingSuggestions: [],
      })
      .mockResolvedValueOnce({
        id: 'item_1',
        sku: 'CUSTOM-1',
        userId: 'dev-user',
        skuManuallySet: true,
        title: 'Camera',
        description: null,
        category: null,
        condition: 'Used',
        brand: null,
        model: null,
        upc: '012345678905',
        scanCode: 'SCAN-99',
        inventoryStatus: 'IN_STOCK',
        listingReadiness: 'NEEDS_PHOTOS',
        saleStatus: 'AVAILABLE',
        bin: { id: 'bin_1', code: 'BIN-A1', label: 'BIN-A1', area: null, note: null, sortOrder: 0, isActive: true },
        photos: [],
        listingDraft: null,
        aiListingSuggestions: [],
        listings: [],
        createdAt: new Date('2026-03-11T15:00:00.000Z'),
        updatedAt: new Date('2026-03-11T15:00:00.000Z'),
      });
    mockedPrisma.bin.findFirst.mockResolvedValue(null);
    mockedPrisma.bin.create.mockResolvedValue({ id: 'bin_1', code: 'BIN-A1', label: 'BIN-A1', area: null, note: null, sortOrder: 0, isActive: true });
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.update('item_1', {
      sku: 'custom 1',
      condition: 'Used',
      binCode: 'bin a1',
      upc: '012345678905',
      scanCode: ' scan-99 ',
      inventoryStatus: 'IN_STOCK',
    }, 'dev-user')) as { sku: string; bin: { code: string } | null; scanCode: string | null };

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sku: 'CUSTOM-1',
          scanCode: 'SCAN-99',
        }),
      }),
    );
    expect(result.sku).toBe('CUSTOM-1');
    expect(result.bin?.code).toBe('BIN-A1');
    expect(result.scanCode).toBe('SCAN-99');
  });

  it('passes search and filter params into the inventory query', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([]);

    await service.list({
      q: 'canon',
      binCode: 'bin-a1',
      inventoryStatus: 'IN_STOCK',
      listingReadiness: 'READY_FOR_AI',
      saleStatus: 'AVAILABLE',
      sort: 'sku-asc',
    }, 'dev-user');

    expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'dev-user',
          inventoryStatus: 'IN_STOCK',
          listingReadiness: 'READY_FOR_AI',
          saleStatus: 'AVAILABLE',
          bin: { is: { code: 'BIN-A1' } },
        }),
        orderBy: [{ sku: 'asc' }],
      }),
    );
  });

  it('rejects invalid bulk update batches before querying inventory', async () => {
    await expect(service.bulkUpdate({ itemIds: [], action: 'MARK_HOLD' }, 'dev-user')).rejects.toThrow(
      'Bulk update requires at least one inventory item id',
    );

    await expect(
      service.bulkUpdate({
        itemIds: Array.from({ length: 101 }, (_, index) => `item_${index}`),
        action: 'MARK_HOLD',
      }, 'dev-user'),
    ).rejects.toThrow('Bulk update is limited to 100 inventory items');

    expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
  });

  it('bulk updates only inventory items owned by the current user', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'item_1', userId: 'dev-user' },
    ]);
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.bulkUpdate({
      itemIds: ['item_1', 'item_2', 'missing_item'],
      action: 'MARK_HOLD',
    }, 'dev-user')) as {
      counts: { updated: number; notFound: number; failed: number };
      results: Array<{ itemId: string; status: string }>;
    };

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['item_1', 'item_2', 'missing_item'] },
          userId: 'dev-user',
        },
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_1' },
        data: { inventoryStatus: 'HOLD' },
      }),
    );
    expect(result.counts).toEqual({ updated: 1, notFound: 2, failed: 0 });
    expect(result.results).toEqual([
      { itemId: 'item_1', status: 'updated' },
      { itemId: 'item_2', status: 'not_found', message: 'Inventory item item_2 not found' },
      { itemId: 'missing_item', status: 'not_found', message: 'Inventory item missing_item not found' },
    ]);
  });

  it('marks a bulk batch available and in stock', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'item_1', userId: 'dev-user' },
      { id: 'item_2', userId: 'dev-user' },
    ]);
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.bulkUpdate({
      itemIds: ['item_1', 'item_2'],
      action: 'MARK_AVAILABLE',
    }, 'dev-user')) as {
      action: string;
      counts: { updated: number; notFound: number; failed: number };
    };

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_1' },
        data: { inventoryStatus: 'IN_STOCK', saleStatus: 'AVAILABLE' },
      }),
    );
    expect(result.action).toBe('MARK_AVAILABLE');
    expect(result.counts).toEqual({ updated: 2, notFound: 0, failed: 0 });
  });

  it('soft deletes a primary photo and promotes the next one', async () => {
    mockedPrisma.photo.findFirst
      .mockResolvedValueOnce({
        id: 'photo_1',
        inventoryItemId: 'item_1',
        isPrimary: true,
      })
      .mockResolvedValueOnce({
        id: 'photo_2',
        inventoryItemId: 'item_1',
        isPrimary: false,
      });
    mockedPrisma.photo.update.mockResolvedValue({});
    mockedPrisma.inventoryItem.findUnique
      .mockResolvedValueOnce({
        id: 'item_1',
        title: 'Camera',
        condition: 'Used',
        saleStatus: 'AVAILABLE',
        photos: [
          {
            uploadStatus: PhotoUploadStatus.READY,
            url: 'https://cdn.test/photo2.jpg',
          },
        ],
        listingDraft: null,
        listings: [],
        aiListingSuggestions: [],
      })
      .mockResolvedValueOnce({
        id: 'item_1',
        sku: 'SKU 123',
        userId: 'dev-user',
        skuManuallySet: false,
        title: 'Camera',
        description: null,
        category: null,
        condition: 'Used',
        brand: null,
        model: null,
        upc: null,
        scanCode: null,
        inventoryStatus: 'DRAFT',
        listingReadiness: 'READY_FOR_AI',
        saleStatus: 'AVAILABLE',
        bin: null,
        photos: [
          {
            id: 'photo_2',
            inventoryItemId: 'item_1',
            url: 'https://cdn.test/photo2.jpg',
            storageBucket: 'omniseller-images',
            storageKey: 'inventory/sku-123/item_1/photos/photo_2/original.jpg',
            role: PhotoAssetRole.ORIGINAL,
            uploadStatus: PhotoUploadStatus.READY,
            sort: 1,
            isPrimary: true,
            originalFileName: 'back.jpg',
            mimeType: 'image/jpeg',
            fileSizeBytes: 2000,
            width: 1200,
            height: 1600,
            metadata: {},
            uploadedAt: new Date('2026-03-11T15:00:00.000Z'),
            createdAt: new Date('2026-03-11T15:00:00.000Z'),
            updatedAt: new Date('2026-03-11T15:00:00.000Z'),
          },
        ],
        listingDraft: null,
        aiListingSuggestions: [],
        listings: [],
        createdAt: new Date('2026-03-11T15:00:00.000Z'),
        updatedAt: new Date('2026-03-11T15:00:00.000Z'),
      });
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.deletePhoto('item_1', 'photo_1', 'dev-user')) as {
      primaryPhoto: { id: string };
      photos: Array<{ id: string }>;
    };

    expect(mockedPrisma.photo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'photo_1' },
        data: expect.objectContaining({ uploadStatus: PhotoUploadStatus.DELETED }),
      }),
    );
    expect(result.primaryPhoto.id).toBe('photo_2');
    expect(result.photos).toHaveLength(1);
  });
});
