import { mkdir, writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import {
  InventoryStatus,
  ListingReadiness,
  PhotoAssetRole,
  PhotoUploadStatus,
  PrismaClient,
  PublishExecutionStatus,
  SaleLifecycleStatus,
  ShipmentStatus,
} from '@prisma/client';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const localUploadsRoot = path.join(repoRoot, 'apps', 'web', 'public', 'local-uploads');
const localStorageBucket = process.env.STORAGE_BUCKET ?? 'omniseller-images';

const envFiles = [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
  path.join(repoRoot, 'packages', 'db', '.env'),
  path.join(repoRoot, 'packages', 'db', '.env.local'),
];

for (const envFile of envFiles) {
  if (!fs.existsSync(envFile)) {
    continue;
  }

  const raw = fs.readFileSync(envFile, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const prisma = new PrismaClient();

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnSUswAAAAASUVORK5CYII=',
  'base64',
);

const fixtureIds = {
  user: 'dev-user',
  ebayAccount: 'seed-ebay-account',
  editableItem: 'seed-item-editable',
  draftItem: 'seed-item-draft',
  readyItem: 'seed-item-ready',
  soldItem: 'seed-item-sold',
  draftListingDraft: 'seed-draft-listing-draft',
  readyListingDraft: 'seed-ready-listing-draft',
  soldListing: 'seed-sold-listing',
  draftPhoto: 'seed-photo-draft-front',
  readyPhotoPrimary: 'seed-photo-ready-front',
  readyPhotoSecondary: 'seed-photo-ready-rear',
  soldPhoto: 'seed-photo-sold-front',
  order: 'local-order-001',
  orderItem: 'local-order-item-001',
  shipment: 'seed-shipment-local-001',
} as const;

const fixtureSkus = {
  editable: 'FIXTURE-EDIT-001',
  draft: 'FIXTURE-DRAFT-001',
  ready: 'FIXTURE-READY-001',
  sold: 'FIXTURE-SOLD-001',
} as const;

async function writeLocalFixtureImage(storageKey: string) {
  const filePath = path.join(localUploadsRoot, ...storageKey.split('/'));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, tinyPng);
}

async function main() {
  console.log('Start seeding...');

  const now = new Date();
  const publishUnavailableMessage = 'Connect an eBay marketplace account before publishing.';
  const shippingUnavailableMessage =
    'Shipping is not configured. Set EASYPOST_API_KEY to enable shipping endpoints.';

  const storageKeys = {
    draftPhoto: `inventory/${fixtureSkus.draft}/original/front.png`,
    readyPhotoPrimary: `inventory/${fixtureSkus.ready}/original/front.png`,
    readyPhotoSecondary: `inventory/${fixtureSkus.ready}/original/rear.png`,
    soldPhoto: `inventory/${fixtureSkus.sold}/original/front.png`,
  } as const;

  await Promise.all(Object.values(storageKeys).map((storageKey) => writeLocalFixtureImage(storageKey)));

  await prisma.user.upsert({
    where: { id: fixtureIds.user },
    update: {
      name: 'Local Dev User',
      email: 'dev-user@local.omniseller',
    },
    create: {
      id: fixtureIds.user,
      name: 'Local Dev User',
      email: 'dev-user@local.omniseller',
    },
  });

  await prisma.marketplaceAccount.upsert({
    where: { id: fixtureIds.ebayAccount },
    update: {
      userId: fixtureIds.user,
      kind: 'ebay',
      nickname: 'Seeded eBay Account',
      siteId: 'EBAY-US',
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    },
    create: {
      id: fixtureIds.ebayAccount,
      userId: fixtureIds.user,
      kind: 'ebay',
      nickname: 'Seeded eBay Account',
      siteId: 'EBAY-US',
    },
  });

  const [intakeBin, readyBin, soldBin] = await Promise.all([
    prisma.bin.upsert({
      where: {
        userId_code: {
          userId: fixtureIds.user,
          code: 'A-01',
        },
      },
      update: {
        label: 'Intake Shelf',
        area: 'INTAKE',
        note: 'Editable fixture storage',
        sortOrder: 10,
        isActive: true,
      },
      create: {
        userId: fixtureIds.user,
        code: 'A-01',
        label: 'Intake Shelf',
        area: 'INTAKE',
        note: 'Editable fixture storage',
        sortOrder: 10,
        isActive: true,
      },
    }),
    prisma.bin.upsert({
      where: {
        userId_code: {
          userId: fixtureIds.user,
          code: 'B-02',
        },
      },
      update: {
        label: 'Photo Ready Rack',
        area: 'READY',
        note: 'Listing-ready fixture storage',
        sortOrder: 20,
        isActive: true,
      },
      create: {
        userId: fixtureIds.user,
        code: 'B-02',
        label: 'Photo Ready Rack',
        area: 'READY',
        note: 'Listing-ready fixture storage',
        sortOrder: 20,
        isActive: true,
      },
    }),
    prisma.bin.upsert({
      where: {
        userId_code: {
          userId: fixtureIds.user,
          code: 'C-03',
        },
      },
      update: {
        label: 'Sold Queue',
        area: 'SOLD',
        note: 'Order fixture storage',
        sortOrder: 30,
        isActive: true,
      },
      create: {
        userId: fixtureIds.user,
        code: 'C-03',
        label: 'Sold Queue',
        area: 'SOLD',
        note: 'Order fixture storage',
        sortOrder: 30,
        isActive: true,
      },
    }),
  ]);

  await Promise.all([
    prisma.inventoryItem.upsert({
      where: { id: fixtureIds.editableItem },
      update: {
        userId: fixtureIds.user,
        sku: fixtureSkus.editable,
        skuManuallySet: true,
        title: 'Fixture Editable Camera Body',
        description: 'Editable local fixture used for inventory CRUD smoke tests.',
        category: 'Cameras',
        condition: 'Used - good',
        brand: 'Canon',
        model: 'AE-1',
        upc: '000111222333',
        scanCode: 'SCAN-EDIT-001',
        costBasisCents: 4200,
        weightGrams: 980,
        dimsCm: { length: 15, width: 10, height: 8 },
        binId: intakeBin.id,
        inventoryStatus: InventoryStatus.IN_STOCK,
        listingReadiness: ListingReadiness.NEEDS_PHOTOS,
        saleStatus: SaleLifecycleStatus.AVAILABLE,
        publishStatus: PublishExecutionStatus.NOT_REQUESTED,
        publishMarketplace: null,
        publishRequestedAt: null,
        publishQueuedAt: null,
        publishStartedAt: null,
        publishedAt: null,
        publishFailedAt: null,
        publishError: null,
      },
      create: {
        id: fixtureIds.editableItem,
        userId: fixtureIds.user,
        sku: fixtureSkus.editable,
        skuManuallySet: true,
        title: 'Fixture Editable Camera Body',
        description: 'Editable local fixture used for inventory CRUD smoke tests.',
        category: 'Cameras',
        condition: 'Used - good',
        brand: 'Canon',
        model: 'AE-1',
        upc: '000111222333',
        scanCode: 'SCAN-EDIT-001',
        costBasisCents: 4200,
        weightGrams: 980,
        dimsCm: { length: 15, width: 10, height: 8 },
        binId: intakeBin.id,
        inventoryStatus: InventoryStatus.IN_STOCK,
        listingReadiness: ListingReadiness.NEEDS_PHOTOS,
        saleStatus: SaleLifecycleStatus.AVAILABLE,
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: fixtureIds.draftItem },
      update: {
        userId: fixtureIds.user,
        sku: fixtureSkus.draft,
        skuManuallySet: true,
        title: 'Fixture Draft Camcorder',
        description: 'Draft-state fixture with photos and an incomplete listing draft.',
        category: 'Camcorders',
        condition: 'Used - tested',
        brand: 'Sony',
        model: 'Handycam',
        upc: '000111222444',
        scanCode: 'SCAN-DRAFT-001',
        costBasisCents: 6800,
        weightGrams: 1220,
        dimsCm: { length: 18, width: 9, height: 11 },
        binId: readyBin.id,
        inventoryStatus: InventoryStatus.IN_STOCK,
        listingReadiness: ListingReadiness.READY_FOR_LISTING,
        saleStatus: SaleLifecycleStatus.AVAILABLE,
        publishStatus: PublishExecutionStatus.NOT_REQUESTED,
        publishMarketplace: null,
        publishRequestedAt: null,
        publishQueuedAt: null,
        publishStartedAt: null,
        publishedAt: null,
        publishFailedAt: null,
        publishError: null,
      },
      create: {
        id: fixtureIds.draftItem,
        userId: fixtureIds.user,
        sku: fixtureSkus.draft,
        skuManuallySet: true,
        title: 'Fixture Draft Camcorder',
        description: 'Draft-state fixture with photos and an incomplete listing draft.',
        category: 'Camcorders',
        condition: 'Used - tested',
        brand: 'Sony',
        model: 'Handycam',
        upc: '000111222444',
        scanCode: 'SCAN-DRAFT-001',
        costBasisCents: 6800,
        weightGrams: 1220,
        dimsCm: { length: 18, width: 9, height: 11 },
        binId: readyBin.id,
        inventoryStatus: InventoryStatus.IN_STOCK,
        listingReadiness: ListingReadiness.READY_FOR_LISTING,
        saleStatus: SaleLifecycleStatus.AVAILABLE,
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: fixtureIds.readyItem },
      update: {
        userId: fixtureIds.user,
        sku: fixtureSkus.ready,
        skuManuallySet: true,
        title: 'Fixture Ready SLR Camera',
        description: 'Publishable fixture with ready photos and a complete listing draft.',
        category: 'SLR Film Cameras',
        condition: 'Used - tested',
        brand: 'Canon',
        model: 'AE-1 Program',
        upc: '000111222555',
        scanCode: 'SCAN-READY-001',
        costBasisCents: 9500,
        weightGrams: 1080,
        dimsCm: { length: 14, width: 9, height: 8 },
        binId: readyBin.id,
        inventoryStatus: InventoryStatus.IN_STOCK,
        listingReadiness: ListingReadiness.READY_TO_PUBLISH,
        saleStatus: SaleLifecycleStatus.AVAILABLE,
        publishStatus: PublishExecutionStatus.UNAVAILABLE,
        publishMarketplace: 'ebay',
        publishRequestedAt: now,
        publishQueuedAt: null,
        publishStartedAt: null,
        publishedAt: null,
        publishFailedAt: now,
        publishError: publishUnavailableMessage,
      },
      create: {
        id: fixtureIds.readyItem,
        userId: fixtureIds.user,
        sku: fixtureSkus.ready,
        skuManuallySet: true,
        title: 'Fixture Ready SLR Camera',
        description: 'Publishable fixture with ready photos and a complete listing draft.',
        category: 'SLR Film Cameras',
        condition: 'Used - tested',
        brand: 'Canon',
        model: 'AE-1 Program',
        upc: '000111222555',
        scanCode: 'SCAN-READY-001',
        costBasisCents: 9500,
        weightGrams: 1080,
        dimsCm: { length: 14, width: 9, height: 8 },
        binId: readyBin.id,
        inventoryStatus: InventoryStatus.IN_STOCK,
        listingReadiness: ListingReadiness.READY_TO_PUBLISH,
        saleStatus: SaleLifecycleStatus.AVAILABLE,
        publishStatus: PublishExecutionStatus.UNAVAILABLE,
        publishMarketplace: 'ebay',
        publishRequestedAt: now,
        publishFailedAt: now,
        publishError: publishUnavailableMessage,
      },
    }),
    prisma.inventoryItem.upsert({
      where: { id: fixtureIds.soldItem },
      update: {
        userId: fixtureIds.user,
        sku: fixtureSkus.sold,
        skuManuallySet: true,
        title: 'Fixture Sold Point-and-Shoot',
        description: 'Sold-order fixture used to exercise order and shipping workflow smoke tests.',
        category: 'Point and Shoot Film Cameras',
        condition: 'Used - excellent',
        brand: 'Olympus',
        model: 'Stylus Epic',
        upc: '000111222666',
        scanCode: 'SCAN-SOLD-001',
        costBasisCents: 7200,
        weightGrams: 540,
        dimsCm: { length: 12, width: 7, height: 5 },
        binId: soldBin.id,
        inventoryStatus: InventoryStatus.HOLD,
        listingReadiness: ListingReadiness.LISTED,
        saleStatus: SaleLifecycleStatus.SOLD,
        publishStatus: PublishExecutionStatus.NOT_REQUESTED,
        publishMarketplace: null,
        publishRequestedAt: null,
        publishQueuedAt: null,
        publishStartedAt: null,
        publishedAt: null,
        publishFailedAt: null,
        publishError: null,
      },
      create: {
        id: fixtureIds.soldItem,
        userId: fixtureIds.user,
        sku: fixtureSkus.sold,
        skuManuallySet: true,
        title: 'Fixture Sold Point-and-Shoot',
        description: 'Sold-order fixture used to exercise order and shipping workflow smoke tests.',
        category: 'Point and Shoot Film Cameras',
        condition: 'Used - excellent',
        brand: 'Olympus',
        model: 'Stylus Epic',
        upc: '000111222666',
        scanCode: 'SCAN-SOLD-001',
        costBasisCents: 7200,
        weightGrams: 540,
        dimsCm: { length: 12, width: 7, height: 5 },
        binId: soldBin.id,
        inventoryStatus: InventoryStatus.HOLD,
        listingReadiness: ListingReadiness.LISTED,
        saleStatus: SaleLifecycleStatus.SOLD,
      },
    }),
  ]);

  await prisma.priceHistory.deleteMany({
    where: {
      inventoryItemId: {
        in: [fixtureIds.editableItem, fixtureIds.draftItem, fixtureIds.readyItem, fixtureIds.soldItem],
      },
    },
  });
  await prisma.listing.deleteMany({ where: { id: fixtureIds.soldListing } });
  await prisma.aiListingSuggestion.deleteMany({
    where: {
      inventoryItemId: {
        in: [fixtureIds.draftItem, fixtureIds.readyItem],
      },
    },
  });
  await prisma.listingDraft.deleteMany({
    where: {
      inventoryItemId: {
        in: [fixtureIds.draftItem, fixtureIds.readyItem],
      },
    },
  });
  await prisma.photo.deleteMany({
    where: {
      inventoryItemId: {
        in: [fixtureIds.draftItem, fixtureIds.readyItem, fixtureIds.soldItem],
      },
    },
  });
  await prisma.shipment.deleteMany({ where: { id: fixtureIds.shipment } });
  await prisma.orderItem.deleteMany({ where: { id: fixtureIds.orderItem } });
  await prisma.order.deleteMany({ where: { id: fixtureIds.order } });

  await prisma.listingDraft.createMany({
    data: [
      {
        id: fixtureIds.draftListingDraft,
        inventoryItemId: fixtureIds.draftItem,
        marketplace: 'ebay',
        title: 'Sony Handycam CCD-TRV58 Hi8 Camcorder',
        description:
          'Draft fixture listing with saved seller edits. This intentionally omits category and price to keep the item in READY_FOR_LISTING.',
        category: null,
        priceCents: null,
        itemSpecifics: {
          Brand: 'Sony',
          Model: 'CCD-TRV58',
          Media: 'Hi8',
        },
        sourceSuggestionId: null,
        metadata: {
          source: 'local-seed',
          note: 'Used to verify manual draft editing and persistence.',
        },
      },
      {
        id: fixtureIds.readyListingDraft,
        inventoryItemId: fixtureIds.readyItem,
        marketplace: 'ebay',
        title: 'Canon AE-1 Program 35mm Film Camera Body',
        description:
          'Ready-to-publish fixture listing draft with complete title, description, category, and price. Used for local listing and publish smoke tests.',
        category: 'SLR Film Cameras',
        priceCents: 18900,
        itemSpecifics: {
          Brand: 'Canon',
          Model: 'AE-1 Program',
          Format: '35mm',
          Type: 'SLR',
        },
        sourceSuggestionId: null,
        metadata: {
          source: 'local-seed',
          note: 'Used to verify READY_TO_PUBLISH behavior.',
        },
      },
    ],
  });

  await prisma.photo.createMany({
    data: [
      {
        id: fixtureIds.draftPhoto,
        inventoryItemId: fixtureIds.draftItem,
        url: `/local-uploads/${storageKeys.draftPhoto}`,
        storageBucket: localStorageBucket,
        storageKey: storageKeys.draftPhoto,
        role: PhotoAssetRole.ORIGINAL,
        uploadStatus: PhotoUploadStatus.READY,
        sort: 0,
        isPrimary: true,
        originalFileName: 'fixture-draft-front.png',
        mimeType: 'image/png',
        fileSizeBytes: tinyPng.byteLength,
        width: 1,
        height: 1,
        metadata: {
          source: 'local-seed',
        },
        uploadedAt: now,
      },
      {
        id: fixtureIds.readyPhotoPrimary,
        inventoryItemId: fixtureIds.readyItem,
        url: `/local-uploads/${storageKeys.readyPhotoPrimary}`,
        storageBucket: localStorageBucket,
        storageKey: storageKeys.readyPhotoPrimary,
        role: PhotoAssetRole.ORIGINAL,
        uploadStatus: PhotoUploadStatus.READY,
        sort: 0,
        isPrimary: true,
        originalFileName: 'fixture-ready-front.png',
        mimeType: 'image/png',
        fileSizeBytes: tinyPng.byteLength,
        width: 1,
        height: 1,
        metadata: {
          source: 'local-seed',
          angle: 'front',
        },
        uploadedAt: now,
      },
      {
        id: fixtureIds.readyPhotoSecondary,
        inventoryItemId: fixtureIds.readyItem,
        url: `/local-uploads/${storageKeys.readyPhotoSecondary}`,
        storageBucket: localStorageBucket,
        storageKey: storageKeys.readyPhotoSecondary,
        role: PhotoAssetRole.ORIGINAL,
        uploadStatus: PhotoUploadStatus.READY,
        sort: 1,
        isPrimary: false,
        originalFileName: 'fixture-ready-rear.png',
        mimeType: 'image/png',
        fileSizeBytes: tinyPng.byteLength,
        width: 1,
        height: 1,
        metadata: {
          source: 'local-seed',
          angle: 'rear',
        },
        uploadedAt: now,
      },
      {
        id: fixtureIds.soldPhoto,
        inventoryItemId: fixtureIds.soldItem,
        url: `/local-uploads/${storageKeys.soldPhoto}`,
        storageBucket: localStorageBucket,
        storageKey: storageKeys.soldPhoto,
        role: PhotoAssetRole.ORIGINAL,
        uploadStatus: PhotoUploadStatus.READY,
        sort: 0,
        isPrimary: true,
        originalFileName: 'fixture-sold-front.png',
        mimeType: 'image/png',
        fileSizeBytes: tinyPng.byteLength,
        width: 1,
        height: 1,
        metadata: {
          source: 'local-seed',
        },
        uploadedAt: now,
      },
    ],
  });

  await prisma.listing.create({
    data: {
      id: fixtureIds.soldListing,
      inventoryItemId: fixtureIds.soldItem,
      marketplaceAccountId: fixtureIds.ebayAccount,
      marketplace: 'ebay',
      marketplaceItemId: 'EBAY-FIXTURE-SOLD-001',
      offerId: 'OFFER-FIXTURE-SOLD-001',
      listingUrl: 'https://www.ebay.com/itm/EBAY-FIXTURE-SOLD-001',
      title: 'Olympus Stylus Epic 35mm Point and Shoot Camera',
      description: 'Seeded sold listing fixture for local orders and shipping smoke tests.',
      category: 'Point and Shoot Film Cameras',
      itemSpecifics: {
        Brand: 'Olympus',
        Model: 'Stylus Epic',
        Format: '35mm',
      },
      priceCents: 21900,
      quantity: 1,
      shippingProfile: 'seed-local-profile',
      status: 'ended',
    },
  });

  await prisma.order.create({
    data: {
      id: fixtureIds.order,
      marketplace: 'ebay',
      marketplaceOrderId: 'LOCAL-ORDER-001',
      marketplaceAccountId: fixtureIds.ebayAccount,
      buyerName: 'Local Buyer',
      buyerAddress: {
        line1: '123 Market St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
      },
      buyerPhone: '555-0100',
      buyerEmail: 'buyer@example.com',
      shippingName: 'Local Buyer',
      shippingCompany: null,
      shippingAddress1: '123 Market St',
      shippingAddress2: null,
      shippingCity: 'Austin',
      shippingState: 'TX',
      shippingPostalCode: '78701',
      shippingCountry: 'US',
      totalCents: 21900,
      feeCents: 1400,
      shippingCents: 0,
      taxCents: 0,
    },
  });

  await prisma.orderItem.create({
    data: {
      id: fixtureIds.orderItem,
      orderId: fixtureIds.order,
      listingId: fixtureIds.soldListing,
      inventoryItemId: fixtureIds.soldItem,
      marketplaceLineItemId: 'LOCAL-LINE-001',
      quantity: 1,
      salePriceCents: 21900,
    },
  });

  await prisma.shipment.create({
    data: {
      id: fixtureIds.shipment,
      orderId: fixtureIds.order,
      provider: 'easypost',
      status: ShipmentStatus.ERROR,
      providerShipmentId: 'shp_seed_local_001',
      providerRateId: 'rate_seed_local_001',
      metadata: {
        purchase: {
          state: 'UNAVAILABLE',
          message: shippingUnavailableMessage,
          failedAt: now.toISOString(),
          recoverable: true,
        },
        lastError: {
          stage: 'purchase',
          message: shippingUnavailableMessage,
          recordedAt: now.toISOString(),
          recoverable: true,
        },
      },
    },
  });

  await prisma.priceHistory.createMany({
    data: [
      {
        inventoryItemId: fixtureIds.readyItem,
        priceCents: 18900,
        source: 'seed-local-draft',
      },
      {
        inventoryItemId: fixtureIds.soldItem,
        listingId: fixtureIds.soldListing,
        priceCents: 21900,
        source: 'seed-local-order',
      },
    ],
  });

  console.log('Seeding finished.');
  console.log(
    JSON.stringify(
      {
        editableSku: fixtureSkus.editable,
        draftSku: fixtureSkus.draft,
        readySku: fixtureSkus.ready,
        soldSku: fixtureSkus.sold,
        orderId: fixtureIds.order,
        marketplaceOrderId: 'LOCAL-ORDER-001',
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
