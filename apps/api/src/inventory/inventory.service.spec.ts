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

  it('exports filtered inventory rows as escaped CSV', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      {
        sku: 'SKU-1',
        title: 'Vintage, Camera',
        description: 'Has "tested" lens',
        category: 'Cameras',
        condition: 'Used',
        brand: 'Canon',
        model: 'AE-1',
        upc: '012345678905',
        scanCode: 'SCAN99',
        costBasisCents: 1234,
        bin: { code: 'BIN-A1' },
        inventoryStatus: 'IN_STOCK',
        listingReadiness: 'NEEDS_PHOTOS',
        saleStatus: 'AVAILABLE',
        createdAt: new Date('2026-03-11T15:00:00.000Z'),
        updatedAt: new Date('2026-03-12T15:00:00.000Z'),
      },
    ]);

    const csv = await service.exportCsv({
      q: 'canon',
      binCode: 'bin a1',
      sort: 'sku-asc',
    }, 'dev-user');

    expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'dev-user',
          bin: { is: { code: 'BIN-A1' } },
        }),
        orderBy: [{ sku: 'asc' }],
        take: 5001,
        include: { bin: true },
      }),
    );
    expect(csv).toBe(
      [
        'sku,title,description,category,condition,brand,model,upc,scanCode,costBasisCents,bin,inventoryStatus,listingReadiness,saleStatus,createdAt,updatedAt',
        'SKU-1,"Vintage, Camera","Has ""tested"" lens",Cameras,Used,Canon,AE-1,012345678905,SCAN99,1234,BIN-A1,IN_STOCK,NEEDS_PHOTOS,AVAILABLE,2026-03-11T15:00:00.000Z,2026-03-12T15:00:00.000Z',
      ].join('\r\n'),
    );
  });

  it('rejects oversized CSV exports before building the response', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue(Array.from({ length: 5001 }, (_, index) => ({
      sku: `SKU-${index}`,
      createdAt: new Date('2026-03-11T15:00:00.000Z'),
      updatedAt: new Date('2026-03-12T15:00:00.000Z'),
    })));

    await expect(service.exportCsv({}, 'dev-user')).rejects.toThrow(
      'CSV export is limited to 5000 items. Apply filters to narrow the result.',
    );
  });

  it('previews quoted CSV rows without writing inventory records', async () => {
    const result = (await service.previewCsvImport({
      csv: [
        'sku,title,description,brand,model,upc,scanCode,costBasisCents,bin',
        'sku-123,"Vintage, Camera","Has ""tested"" lens",Canon,AE-1,012345678905," scan 99 ","$12.34",bin a1',
        '',
      ].join('\r\n'),
    }, 'dev-user')) as {
      totalRows: number;
      validRows: number;
      invalidRows: number;
      headers: string[];
      rows: Array<{ rowNumber: number; normalized: Record<string, unknown>; errors: string[]; warnings: string[] }>;
    };

    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(0);
    expect(result.headers).toEqual(['sku', 'title', 'description', 'brand', 'model', 'upc', 'scanCode', 'costBasisCents', 'bin']);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      normalized: {
        sku: 'SKU-123',
        title: 'Vintage, Camera',
        description: 'Has "tested" lens',
        brand: 'Canon',
        model: 'AE-1',
        upc: '012345678905',
        scanCode: 'SCAN99',
        costBasisCents: 1234,
        binCode: 'BIN-A1',
      },
      errors: [],
      warnings: [],
    });
    expect(mockedPrisma.inventoryItem.create).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(mockedPrisma.bin.create).not.toHaveBeenCalled();
    expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it('returns per-row CSV validation errors and warnings', async () => {
    const result = (await service.previewCsvImport({
      csv: [
        'sku,title,costBasisCents,extra',
        'ab,,12.345,ignored',
        ',,,',
        'SKU-123,Valid item,100,',
      ].join('\n'),
    }, 'dev-user')) as {
      totalRows: number;
      validRows: number;
      invalidRows: number;
      rows: Array<{ normalized: Record<string, unknown>; errors: string[]; warnings: string[] }>;
    };

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(2);
    expect(result.rows[0].normalized).toEqual({ sku: 'AB', title: null });
    expect(result.rows[0].errors).toEqual([
      'costBasisCents must be a non-negative cent value or dollar amount',
      'SKU must be at least 4 characters after normalization',
    ]);
    expect(result.rows[0].warnings).toEqual(['Column "extra" is not recognized and will be ignored']);
    expect(result.rows[1].errors).toEqual(['Row does not contain any inventory values']);
    expect(mockedPrisma.inventoryItem.create).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
  });

  it('rejects empty and oversized CSV previews before database access', async () => {
    await expect(service.previewCsvImport({ csv: '   ' }, 'dev-user')).rejects.toThrow('CSV content cannot be empty');

    await expect(
      service.previewCsvImport({
        csv: ['sku,title', ...Array.from({ length: 1001 }, (_, index) => `SKU-${index},Item ${index}`)].join('\n'),
      }, 'dev-user'),
    ).rejects.toThrow('CSV import is limited to 1000 data rows');

    expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.create).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it('rejects malformed quoted CSV fields before database access', async () => {
    await expect(service.previewCsvImport({ csv: 'sku,title\nSKU-1,"Unclosed title' }, 'dev-user')).rejects.toThrow(
      'CSV contains an unterminated quoted field',
    );
    await expect(service.previewCsvImport({ csv: 'sku,title\nSKU-1,"Title"extra' }, 'dev-user')).rejects.toThrow(
      'Unexpected character after closing quote',
    );
    await expect(service.previewCsvImport({ csv: 'sku,title\nSKU-1,Title "quoted"' }, 'dev-user')).rejects.toThrow(
      'Unexpected quote',
    );

    expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.create).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(mockedPrisma.bin.create).not.toHaveBeenCalled();
    expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it('does not treat ambiguous cost CSV headers as cost basis cents', async () => {
    const result = (await service.previewCsvImport({
      csv: 'sku,title,cost\nSKU-123,Camera,50',
    }, 'dev-user')) as {
      rows: Array<{ normalized: Record<string, unknown>; warnings: string[] }>;
    };

    expect(result.rows[0].normalized).toEqual({
      sku: 'SKU-123',
      title: 'Camera',
    });
    expect(result.rows[0].warnings).toEqual(['Column "cost" is not recognized and will be ignored']);
  });

  it('applies valid CSV import rows and creates bins on demand', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([]);
    mockedPrisma.bin.findFirst.mockResolvedValue(null);
    mockedPrisma.bin.create.mockResolvedValue({ id: 'bin_1', code: 'BIN-A1', label: 'BIN-A1' });
    mockedPrisma.inventoryItem.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...data,
        createdAt: new Date('2026-03-11T15:00:00.000Z'),
        updatedAt: new Date('2026-03-11T15:00:00.000Z'),
      }),
    );

    const result = (await service.applyCsvImport({
      csv: [
        'sku,title,description,condition,brand,model,upc,scanCode,costBasisCents,bin',
        'sku-123,Vintage Camera,Tested body,Used,Canon,AE-1,012345678905,scan 99,$12.34,bin a1',
        ',Untitled Lot,,New,,,,,500,',
      ].join('\n'),
    }, 'dev-user')) as {
      requestedRows: number;
      created: number;
      failed: number;
      skipped: number;
      binsCreated: number;
      results: Array<{ status: string; sku: string }>;
    };

    expect(mockedPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dev-user' },
      }),
    );
    expect(mockedPrisma.bin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'dev-user',
          code: 'BIN-A1',
        }),
      }),
    );
    expect(mockedPrisma.inventoryItem.create).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'dev-user',
          sku: 'SKU-123',
          skuManuallySet: true,
          title: 'Vintage Camera',
          description: 'Tested body',
          condition: 'Used',
          brand: 'Canon',
          model: 'AE-1',
          upc: '012345678905',
          scanCode: 'SCAN99',
          costBasisCents: 1234,
          binId: 'bin_1',
          inventoryStatus: 'IN_STOCK',
          listingReadiness: 'NEEDS_PHOTOS',
        }),
      }),
    );
    expect(result.requestedRows).toBe(2);
    expect(result.created).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.binsCreated).toBe(1);
    expect(result.results[0]).toEqual(expect.objectContaining({ status: 'created', sku: 'SKU-123' }));
    expect(result.results[1].sku).toMatch(/^INV-\d{8}-[A-Z0-9]{6}$/);
  });

  it('skips duplicate and existing CSV SKUs during apply', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([{ sku: 'EXISTING-1' }]);

    const result = (await service.applyCsvImport({
      csv: [
        'sku,title',
        'existing-1,Already exists',
        'dup-1,First duplicate',
        'dup-1,Second duplicate',
        'ab,Too short',
      ].join('\n'),
    }, 'dev-user')) as {
      created: number;
      failed: number;
      skipped: number;
      duplicateSku: number;
      results: Array<{ rowNumber: number; status: string; message?: string; errors?: string[] }>;
    };

    expect(mockedPrisma.inventoryItem.create).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(3);
    expect(result.duplicateSku).toBe(1);
    expect(result.results).toEqual([
      expect.objectContaining({ rowNumber: 2, status: 'skipped', message: 'SKU EXISTING-1 already exists' }),
      expect.objectContaining({ rowNumber: 3, status: 'skipped', message: 'SKU DUP-1 appears more than once in the CSV' }),
      expect.objectContaining({ rowNumber: 4, status: 'skipped', message: 'SKU DUP-1 appears more than once in the CSV' }),
      expect.objectContaining({ rowNumber: 5, status: 'failed', errors: ['SKU must be at least 4 characters after normalization'] }),
    ]);
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
      { id: 'item_1', userId: 'dev-user', saleStatus: 'AVAILABLE', photos: [] },
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
      { id: 'item_1', userId: 'dev-user', saleStatus: 'AVAILABLE', photos: [] },
      { id: 'item_2', userId: 'dev-user', saleStatus: 'AVAILABLE', photos: [] },
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

  it('assigns a bin to a bulk batch and creates the bin when needed', async () => {
    mockedPrisma.bin.findFirst.mockResolvedValue(null);
    mockedPrisma.bin.create.mockResolvedValue({ id: 'bin_1', code: 'BIN-A1', label: 'BIN-A1' });
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'item_1', userId: 'dev-user', inventoryStatus: 'DRAFT', saleStatus: 'AVAILABLE', photos: [] },
      { id: 'item_2', userId: 'dev-user', inventoryStatus: 'IN_STOCK', saleStatus: 'AVAILABLE', photos: [] },
    ]);
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.bulkUpdate({
      itemIds: ['item_1', 'item_2'],
      action: 'ASSIGN_BIN',
      binCode: 'bin a1',
    }, 'dev-user')) as {
      action: string;
      counts: { updated: number; notFound: number; failed: number };
    };

    expect(mockedPrisma.bin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'dev-user',
          code: 'BIN-A1',
        }),
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_1' },
        data: { binId: 'bin_1', inventoryStatus: 'IN_STOCK' },
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_2' },
        data: { binId: 'bin_1' },
      }),
    );
    expect(result.action).toBe('ASSIGN_BIN');
    expect(result.counts).toEqual({ updated: 2, notFound: 0, failed: 0 });
  });

  it('requires a bin code and skips archived items for bulk bin assignment', async () => {
    await expect(service.bulkUpdate({ itemIds: ['item_1'], action: 'ASSIGN_BIN' }, 'dev-user')).rejects.toThrow(
      'Bulk bin assignment requires a binCode',
    );

    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'archived_item', userId: 'dev-user', inventoryStatus: 'ARCHIVED', saleStatus: 'AVAILABLE', photos: [] },
    ]);

    const result = (await service.bulkUpdate({
      itemIds: ['archived_item'],
      action: 'ASSIGN_BIN',
      binCode: 'bin a1',
    }, 'dev-user')) as {
      counts: { updated: number; notFound: number; failed: number };
      results: Array<{ itemId: string; status: string; message?: string }>;
    };

    expect(mockedPrisma.bin.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.bin.create).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(result.counts).toEqual({ updated: 0, notFound: 0, failed: 1 });
    expect(result.results).toEqual([
      {
        itemId: 'archived_item',
        status: 'failed',
        message: 'Inventory item archived_item cannot be assigned a bin while archived',
      },
    ]);
  });

  it('does not bulk hold listed or reserved inventory', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'available_item', userId: 'dev-user', saleStatus: 'AVAILABLE', photos: [] },
      { id: 'sold_item', userId: 'dev-user', saleStatus: 'SOLD', photos: [] },
      { id: 'listed_item', userId: 'dev-user', saleStatus: 'LISTED', photos: [] },
      { id: 'reserved_item', userId: 'dev-user', saleStatus: 'RESERVED', photos: [] },
    ]);
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.bulkUpdate({
      itemIds: ['available_item', 'sold_item', 'listed_item', 'reserved_item'],
      action: 'MARK_HOLD',
    }, 'dev-user')) as {
      counts: { updated: number; notFound: number; failed: number };
      results: Array<{ itemId: string; status: string; message?: string }>;
    };

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'available_item' },
        data: { inventoryStatus: 'HOLD' },
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sold_item' },
        data: { inventoryStatus: 'HOLD' },
      }),
    );
    expect(result.counts).toEqual({ updated: 2, notFound: 0, failed: 2 });
    expect(result.results).toEqual([
      { itemId: 'available_item', status: 'updated' },
      { itemId: 'sold_item', status: 'updated' },
      {
        itemId: 'listed_item',
        status: 'failed',
        message: 'Inventory item listed_item cannot be put on hold while sale state is listed',
      },
      {
        itemId: 'reserved_item',
        status: 'failed',
        message: 'Inventory item reserved_item cannot be put on hold while sale state is reserved',
      },
    ]);
  });

  it('does not bulk mark sold, shipped, reserved, or listed inventory available', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'sold_item', userId: 'dev-user', saleStatus: 'SOLD', photos: [] },
      { id: 'shipped_item', userId: 'dev-user', saleStatus: 'SHIPPED', photos: [] },
      { id: 'reserved_item', userId: 'dev-user', saleStatus: 'RESERVED', photos: [] },
      { id: 'listed_item', userId: 'dev-user', saleStatus: 'LISTED', photos: [] },
    ]);

    const result = (await service.bulkUpdate({
      itemIds: ['sold_item', 'shipped_item', 'reserved_item', 'listed_item'],
      action: 'MARK_AVAILABLE',
    }, 'dev-user')) as {
      counts: { updated: number; notFound: number; failed: number };
      results: Array<{ itemId: string; status: string; message?: string }>;
    };

    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(result.counts).toEqual({ updated: 0, notFound: 0, failed: 4 });
    expect(result.results).toEqual([
      {
        itemId: 'sold_item',
        status: 'failed',
        message: 'Inventory item sold_item cannot be marked available while sale state is sold',
      },
      {
        itemId: 'shipped_item',
        status: 'failed',
        message: 'Inventory item shipped_item cannot be marked available while sale state is shipped',
      },
      {
        itemId: 'reserved_item',
        status: 'failed',
        message: 'Inventory item reserved_item cannot be marked available while sale state is reserved',
      },
      {
        itemId: 'listed_item',
        status: 'failed',
        message: 'Inventory item listed_item cannot be marked available while sale state is listed',
      },
    ]);
  });

  it('does not bulk archive inventory with active or terminal sale states', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'available_item', userId: 'dev-user', saleStatus: 'AVAILABLE', photos: [] },
      { id: 'listed_item', userId: 'dev-user', saleStatus: 'LISTED', photos: [] },
      { id: 'reserved_item', userId: 'dev-user', saleStatus: 'RESERVED', photos: [] },
      { id: 'sold_item', userId: 'dev-user', saleStatus: 'SOLD', photos: [] },
    ]);
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.bulkUpdate({
      itemIds: ['available_item', 'listed_item', 'reserved_item', 'sold_item'],
      action: 'ARCHIVE',
    }, 'dev-user')) as {
      counts: { updated: number; notFound: number; failed: number };
    };

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'available_item' },
        data: { inventoryStatus: 'ARCHIVED' },
      }),
    );
    expect(result.counts).toEqual({ updated: 1, notFound: 0, failed: 3 });
  });

  it('requires intake basics and a ready photo before bulk marking ready for listing', async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'ready_item', userId: 'dev-user', saleStatus: 'AVAILABLE', title: 'Camera', condition: 'Used', photos: [{ id: 'photo_1' }] },
      { id: 'missing_photo', userId: 'dev-user', saleStatus: 'AVAILABLE', title: 'Camera', condition: 'Used', photos: [] },
      { id: 'sold_item', userId: 'dev-user', saleStatus: 'SOLD', title: 'Camera', condition: 'Used', photos: [{ id: 'photo_2' }] },
    ]);
    mockedPrisma.inventoryItem.update.mockResolvedValue({});

    const result = (await service.bulkUpdate({
      itemIds: ['ready_item', 'missing_photo', 'sold_item'],
      action: 'MARK_READY_FOR_LISTING',
    }, 'dev-user')) as {
      counts: { updated: number; notFound: number; failed: number };
    };

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ready_item' },
        data: { listingReadiness: 'READY_FOR_LISTING' },
      }),
    );
    expect(result.counts).toEqual({ updated: 1, notFound: 0, failed: 2 });
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
