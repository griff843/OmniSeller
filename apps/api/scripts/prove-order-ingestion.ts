import { createServer } from 'http';
import { once } from 'events';
import { prisma } from '@omniseller/db';
import { EbayOrderSyncService } from '../src/ebay/ebay-order-sync.service';
import { encryptProviderToken } from '../src/common/provider-token-vault';

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.OMNISELLER_TOKEN_ACTIVE_KEY_ID = 'proof-v1';
  process.env.OMNISELLER_TOKEN_ENCRYPTION_KEYS = JSON.stringify({ 'proof-v1': Buffer.alloc(32, 11).toString('base64') });
  let cancelled = false;
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ total: 1, orders: [{
      orderId: 'proof-ebay-order-1', creationDate: '2026-07-15T18:00:00.000Z', lastModifiedDate: '2026-07-15T18:01:00.000Z',
      orderFulfillmentStatus: 'NOT_STARTED', cancelStatus: { cancelState: cancelled ? 'CANCELLED' : 'NONE_REQUESTED' },
      pricingSummary: { total: { value: '42.50', currency: 'USD' }, deliveryCost: { value: '5.00' }, tax: { value: '2.50' } },
      buyer: { username: 'sanitized-proof-buyer' },
      fulfillmentStartInstructions: [{ shippingStep: { shipTo: { fullName: 'Proof Buyer', addressLine1: '1 Test Way', city: 'Austin', stateOrProvince: 'TX', postalCode: '78701', countryCode: 'US' } } }],
      lineItems: [{ lineItemId: 'proof-line-1', legacyItemId: 'proof-listing-1', sku: 'PROOF-SKU-1', quantity: 1, lineItemCost: { value: '35.00' } }],
    }] }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Proof provider did not bind');
  const user = await prisma.user.create({ data: { email: `order-proof-${Date.now()}@local.invalid` } });
  try {
    const encrypted = encryptProviderToken('fake-provider-token');
    const account = await prisma.marketplaceAccount.create({ data: { userId: user.id, kind: 'ebay', accessToken: encrypted.value, refreshToken: encrypted.value, tokenKeyId: encrypted.keyId } });
    const item = await prisma.inventoryItem.create({ data: { userId: user.id, sku: 'PROOF-SKU-1', title: 'Proof item', saleStatus: 'LISTED' } });
    await prisma.listing.create({ data: { inventoryItemId: item.id, marketplaceAccountId: account.id, marketplace: 'ebay', marketplaceItemId: 'proof-listing-1', priceCents: 3500, status: 'active' } });
    const service = new EbayOrderSyncService({ get: (name: string) => name === 'EBAY_API_BASE' ? `http://127.0.0.1:${address.port}` : undefined } as any);
    const first = await service.syncAccount(account.id);
    const second = await service.syncAccount(account.id);
    const orderCount = await prisma.order.count({ where: { marketplaceOrderId: 'proof-ebay-order-1' } });
    const lineCount = await prisma.orderItem.count({ where: { marketplaceLineItemId: 'proof-line-1' } });
    const sold = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    if (orderCount !== 1 || lineCount !== 1 || sold.saleStatus !== 'SOLD') throw new Error('Replay proof failed');
    cancelled = true;
    await service.syncAccount(account.id);
    const cancelledItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    const order = await prisma.order.findUniqueOrThrow({ where: { marketplaceOrderId: 'proof-ebay-order-1' } });
    if (order.status !== 'CANCELLED' || cancelledItem.saleStatus !== 'LISTED') throw new Error('Cancellation proof failed');
    console.log(JSON.stringify({ first, second, orderCount, lineCount, soldState: sold.saleStatus, cancellationState: order.status, restoredInventoryState: cancelledItem.saleStatus }));
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    server.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
