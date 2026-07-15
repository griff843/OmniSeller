import { prisma, ShipmentStatus } from '@omniseller/db';
import { ListingsService } from '../src/listings/listings.service';
import { ShippingService } from '../src/shipping/shipping.service';

async function main() {
  process.env.NODE_ENV = 'test';
  const stamp = Date.now();
  const user = await prisma.user.create({ data: { email: `concurrency-${stamp}@local.invalid` } });
  try {
    const account = await prisma.marketplaceAccount.create({ data: { userId: user.id, kind: 'ebay', accessToken: 'test-token' } });
    const item = await prisma.inventoryItem.create({ data: { userId: user.id, sku: `CONC-${stamp}`, title: 'Concurrent item', condition: 'Used', publishStatus: 'NOT_REQUESTED', photos: { create: { storageBucket: 'proof', storageKey: `proof/${stamp}.jpg`, uploadStatus: 'READY', url: 'https://example.invalid/photo.jpg' } }, listingDraft: { create: { title: 'Concurrent listing', description: 'Proof description', category: '31388', priceCents: 1000 } } } });
    let queued = 0;
    const listings = new ListingsService({ add: async () => { queued += 1; } } as any, { getAvailability: (_marketplace: string, marketplaceAccount: any) => ({ available: true, marketplaceAccount }) } as any);
    const publish = await Promise.allSettled([listings.enqueuePublish(item.id, 'ebay', user.id), listings.enqueuePublish(item.id, 'ebay', user.id)]);
    if (queued !== 1 || publish.filter((result) => result.status === 'fulfilled').length !== 1) throw new Error('Concurrent publish claim failed');

    const order = await prisma.order.create({ data: { marketplace: 'ebay', marketplaceOrderId: `CONC-ORDER-${stamp}`, marketplaceAccountId: account.id, totalCents: 1000 } });
    let purchases = 0;
    const easyPost = { isConfigured: () => true, buyShipment: async () => { purchases += 1; await new Promise((resolve) => setTimeout(resolve, 100)); return { id: `provider-${stamp}`, selected_rate: { id: 'rate-proof', carrier: 'USPS', service: 'Ground', rate: '5.00', currency: 'USD' }, tracker: { id: 'tracker-proof', tracking_code: 'proof', status: 'pre_transit' }, postage_label: { label_pdf_url: 'https://example.invalid/label.pdf' }, parcel: {} }; } };
    const shipping = new ShippingService({ get: () => undefined } as any, easyPost as any, { add: async () => undefined } as any);
    const purchase = await Promise.allSettled([
      shipping.purchaseLabel({ orderId: order.id, providerShipmentId: `provider-${stamp}`, rateId: 'rate-proof' }, user.id),
      shipping.purchaseLabel({ orderId: order.id, providerShipmentId: `provider-${stamp}`, rateId: 'rate-proof' }, user.id),
    ]);
    const shipmentCount = await prisma.shipment.count({ where: { orderId: order.id } });
    const persisted = await prisma.shipment.findFirstOrThrow({ where: { orderId: order.id } });
    if (purchases !== 1 || shipmentCount !== 1 || persisted.status !== ShipmentStatus.SYNC_QUEUED) throw new Error('Concurrent label claim failed');
    console.log(JSON.stringify({ publish: { queued, fulfilled: publish.filter((entry) => entry.status === 'fulfilled').length }, label: { providerPurchases: purchases, shipmentCount, status: persisted.status, results: purchase.map((entry) => entry.status) } }));
  } finally { await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
