import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userId = 'dev-user';
const accountId = 'local-ebay-account';
const itemId = 'local-ready-item';
const soldItemId = 'local-sold-item';
const listingId = 'local-sold-listing';
const orderId = 'local-order-001';
const photoId = 'local-ready-photo';
const storageKey = `inventory/fixture-ready-001/${itemId}/photos/${photoId}/original.png`;

async function writeFixturePhoto() {
  const root = path.resolve(__dirname, '..', '..', '..', 'apps', 'web', 'public', 'local-uploads');
  const target = path.join(root, ...storageKey.split('/'));
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnSUswAAAAASUVORK5CYII=',
    'base64',
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, tinyPng);
}

async function main() {
  await writeFixturePhoto();

  await prisma.user.upsert({
    where: { id: userId },
    update: { email: 'dev-user@local.omniseller', name: 'Local Dev User' },
    create: { id: userId, email: 'dev-user@local.omniseller', name: 'Local Dev User' },
  });

  const bin = await prisma.bin.upsert({
    where: { userId_code: { userId, code: 'BETA-01' } },
    update: { label: 'Beta Smoke Bin', area: 'READY', isActive: true },
    create: { userId, code: 'BETA-01', label: 'Beta Smoke Bin', area: 'READY', isActive: true },
  });

  await prisma.marketplaceAccount.upsert({
    where: { id: accountId },
    update: { userId, kind: 'ebay', nickname: 'Local eBay fixture' },
    create: { id: accountId, userId, kind: 'ebay', nickname: 'Local unavailable eBay fixture', siteId: 'EBAY-US' },
  });

  const readyItem = await prisma.inventoryItem.upsert({
    where: { sku: 'FIXTURE-READY-001' },
    update: {
      userId,
      sku: 'FIXTURE-READY-001',
      title: 'Fixture Ready SLR Camera',
      description: 'Repeatable local product workflow fixture.',
      category: '31388',
      condition: 'Used - very good',
      brand: 'Canon',
      model: 'AE-1',
      binId: bin.id,
      inventoryStatus: 'IN_STOCK',
      listingReadiness: 'READY_TO_PUBLISH',
      saleStatus: 'AVAILABLE',
      publishStatus: 'UNAVAILABLE',
      publishMarketplace: 'ebay',
      publishError: 'Connect a configured eBay sandbox account before publishing.',
    },
    create: {
      id: itemId,
      userId,
      sku: 'FIXTURE-READY-001',
      skuManuallySet: true,
      title: 'Fixture Ready SLR Camera',
      description: 'Repeatable local product workflow fixture.',
      category: '31388',
      condition: 'Used - very good',
      brand: 'Canon',
      model: 'AE-1',
      binId: bin.id,
      inventoryStatus: 'IN_STOCK',
      listingReadiness: 'READY_TO_PUBLISH',
      saleStatus: 'AVAILABLE',
      publishStatus: 'UNAVAILABLE',
      publishMarketplace: 'ebay',
      publishError: 'Connect a configured eBay sandbox account before publishing.',
    },
  });

  await prisma.photo.upsert({
    where: { storageKey },
    update: {
      inventoryItemId: readyItem.id,
      url: `/local-uploads/${storageKey}`,
      storageKey,
      uploadStatus: 'READY',
      isPrimary: true,
      uploadedAt: new Date(),
    },
    create: {
      id: photoId,
      inventoryItemId: readyItem.id,
      url: `/local-uploads/${storageKey}`,
      storageBucket: 'omniseller-images',
      storageKey,
      role: 'ORIGINAL',
      uploadStatus: 'READY',
      sort: 0,
      isPrimary: true,
      originalFileName: 'fixture.png',
      mimeType: 'image/png',
      uploadedAt: new Date(),
    },
  });

  await prisma.listingDraft.upsert({
    where: { inventoryItemId: readyItem.id },
    update: {
      marketplace: 'ebay',
      title: 'Canon AE-1 35mm Film Camera',
      description: 'Tested Canon AE-1 camera body in very good used condition.',
      category: '31388',
      priceCents: 14900,
      itemSpecifics: { Brand: 'Canon', Model: 'AE-1' },
    },
    create: {
      inventoryItemId: readyItem.id,
      marketplace: 'ebay',
      title: 'Canon AE-1 35mm Film Camera',
      description: 'Tested Canon AE-1 camera body in very good used condition.',
      category: '31388',
      priceCents: 14900,
      itemSpecifics: { Brand: 'Canon', Model: 'AE-1' },
    },
  });

  const soldItem = await prisma.inventoryItem.upsert({
    where: { sku: 'FIXTURE-SOLD-001' },
    update: {
      userId,
      sku: 'FIXTURE-SOLD-001',
      title: 'Fixture Sold Point-and-Shoot Camera',
      description: 'Local sold-order fixture; no external marketplace event is implied.',
      category: '15230',
      condition: 'Used - good',
      binId: bin.id,
      inventoryStatus: 'HOLD',
      listingReadiness: 'LISTED',
      saleStatus: 'SOLD',
    },
    create: {
      id: soldItemId,
      userId,
      sku: 'FIXTURE-SOLD-001',
      skuManuallySet: true,
      title: 'Fixture Sold Point-and-Shoot Camera',
      description: 'Local sold-order fixture; no external marketplace event is implied.',
      category: '15230',
      condition: 'Used - good',
      binId: bin.id,
      inventoryStatus: 'HOLD',
      listingReadiness: 'LISTED',
      saleStatus: 'SOLD',
    },
  });

  await prisma.listing.upsert({
    where: { id: listingId },
    update: { inventoryItemId: soldItem.id, marketplaceAccountId: accountId, status: 'sold' },
    create: {
      id: listingId,
      inventoryItemId: soldItem.id,
      marketplaceAccountId: accountId,
      marketplace: 'ebay',
      marketplaceItemId: 'LOCAL-NOT-EXTERNAL',
      title: 'Local sold-order fixture',
      description: 'Local-only record; not an external marketplace listing.',
      category: '31388',
      priceCents: 14900,
      status: 'sold',
    },
  });

  await prisma.order.upsert({
    where: { marketplaceOrderId: 'LOCAL-ORDER-001' },
    update: { marketplaceAccountId: accountId, buyerName: 'Local Test Buyer', totalCents: 15900 },
    create: {
      id: orderId,
      marketplace: 'local-fixture',
      marketplaceOrderId: 'LOCAL-ORDER-001',
      marketplaceAccountId: accountId,
      buyerName: 'Local Test Buyer',
      buyerEmail: 'buyer@example.test',
      shippingName: 'Local Test Buyer',
      shippingAddress1: '123 Test Street',
      shippingCity: 'Endicott',
      shippingState: 'NY',
      shippingPostalCode: '13760',
      shippingCountry: 'US',
      totalCents: 15900,
      shippingCents: 1000,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: 'local-order-item-001' },
    update: { orderId, listingId, inventoryItemId: soldItem.id, quantity: 1, salePriceCents: 14900 },
    create: {
      id: 'local-order-item-001',
      orderId,
      listingId,
      inventoryItemId: soldItem.id,
      marketplaceLineItemId: 'LOCAL-LINE-001',
      quantity: 1,
      salePriceCents: 14900,
    },
  });

  console.log('Seeded repeatable local fixtures:', { userId, itemId: readyItem.id, soldItemId: soldItem.id, orderId });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
