import { prisma } from '@omniseller/db';

async function main() {
  const base = process.env.PROOF_API_BASE ?? 'http://127.0.0.1:3001';
  const secret = process.env.OMNISELLER_API_INTERNAL_SECRET;
  if (!secret) throw new Error('OMNISELLER_API_INTERNAL_SECRET is required');
  const stamp = Date.now();
  const sellerA = await prisma.user.create({ data: { email: `isolation-a-${stamp}@local.invalid` } });
  const sellerB = await prisma.user.create({ data: { email: `isolation-b-${stamp}@local.invalid` } });
  try {
    const account = await prisma.marketplaceAccount.create({ data: { userId: sellerA.id, kind: 'ebay' } });
    const item = await prisma.inventoryItem.create({ data: { userId: sellerA.id, sku: `ISOLATION-${stamp}`, title: 'Seller A private item' } });
    const listing = await prisma.listing.create({ data: { inventoryItemId: item.id, marketplaceAccountId: account.id, marketplace: 'ebay', priceCents: 1000 } });
    const order = await prisma.order.create({ data: { marketplace: 'ebay', marketplaceOrderId: `ISOLATION-ORDER-${stamp}`, marketplaceAccountId: account.id, totalCents: 1000, items: { create: { listingId: listing.id, inventoryItemId: item.id, marketplaceLineItemId: `ISOLATION-LINE-${stamp}`, salePriceCents: 1000 } } } });
    const shipment = await prisma.shipment.create({ data: { orderId: order.id, provider: 'easypost' } });
    const headers = { 'x-omniseller-internal-secret': secret, 'x-omniseller-user-id': sellerB.id, 'content-type': 'application/json' };
    const checks: Array<[string, string, RequestInit?]> = [
      ['inventory-read', `/inventory/${item.id}`],
      ['inventory-write', `/inventory/${item.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'unauthorized' }) }],
      ['listing-workspace', `/listings/${item.id}/ai`],
      ['order-read', `/orders/${order.id}`],
      ['shipment-list', `/shipping/order/${order.id}`],
      ['shipment-write', `/shipping/${shipment.id}/void`, { method: 'POST', body: '{}' }],
    ];
    const results = [];
    for (const [name, path, init] of checks) {
      const response = await fetch(`${base}${path}`, { ...init, headers });
      results.push({ name, status: response.status });
      if (response.status !== 404) throw new Error(`${name} returned ${response.status}, expected safe 404`);
    }
    await prisma.user.update({ where: { id: sellerB.id }, data: { disabledAt: new Date(), disabledReason: 'proof revocation' } });
    const revoked = await fetch(`${base}/inventory`, { headers });
    results.push({ name: 'revoked-account', status: revoked.status });
    if (revoked.status !== 401) throw new Error(`revoked account returned ${revoked.status}, expected 401`);
    console.log(JSON.stringify({ sellerA: sellerA.id, sellerB: sellerB.id, results }));
  } finally {
    await prisma.user.delete({ where: { id: sellerA.id } });
    await prisma.user.delete({ where: { id: sellerB.id } });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
