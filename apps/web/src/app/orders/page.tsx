import Link from 'next/link';
import { fetchApi } from '@/lib/api-base';
import { StatusBadge, type BadgeTone } from '@/components/shipping/status-badge';
import { Order, formatCents, formatShipmentStatus, getLatestShipment, getSyncState } from '@/features/orders/types';

export const dynamic = 'force-dynamic';

function getTone(status: string): BadgeTone {
  if (status === 'SYNCED_TO_MARKETPLACE' || status === 'LABEL_PURCHASED') return 'success';
  if (status === 'SYNC_QUEUED') return 'info';
  if (status === 'ERROR') return 'danger';
  return 'neutral';
}

export default async function OrdersPage() {
  const orders = await fetchApi<Order[]>('/orders');

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Orders and fulfillment</h1>
            <p className="mt-2 text-sm text-slate-600">Monitor shipping state, open an order, and move directly into label purchase when an order is ready to ship.</p>
          </div>
          <Link href="/inventory" className="text-sm font-medium text-sky-700 underline">
            Back to inventory
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Buyer</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Shipping</th>
                  <th className="px-4 py-3 font-semibold">Tracking</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No orders are available yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const shipment = getLatestShipment(order);
                    const syncState = getSyncState(shipment);

                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 align-top">
                          <Link href={`/orders/${order.id}`} className="font-semibold text-slate-950 underline">
                            {order.marketplaceOrderId}
                          </Link>
                          <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{order.marketplaceAccount?.kind ?? order.marketplace}</div>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">
                          <div>{order.shippingName ?? order.buyerName ?? 'Customer'}</div>
                          <div className="text-xs text-slate-500">{order.shippingCity ?? '--'}, {order.shippingState ?? '--'}</div>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">
                          <div>{order.items.reduce((sum, item) => sum + item.quantity, 0)} units</div>
                          <div className="text-xs text-slate-500">
                            {order.items[0]?.inventoryItem?.sku ?? 'No SKU linked'}
                            {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top font-medium text-slate-900">{formatCents(order.totalCents)}</td>
                        <td className="px-4 py-4 align-top">
                          {shipment ? (
                            <div className="flex flex-col gap-2">
                              <StatusBadge tone={getTone(shipment.status)}>
                                {formatShipmentStatus(shipment.status)}
                              </StatusBadge>
                              <StatusBadge tone={syncState === 'FAILED' || syncState === 'QUEUE_FAILED' ? 'danger' : 'info'}>
                                Sync {syncState.toLowerCase().replace(/_/g, ' ')}
                              </StatusBadge>
                            </div>
                          ) : (
                            <StatusBadge tone="neutral">Unfulfilled</StatusBadge>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">{shipment?.trackingCode ?? '--'}</td>
                        <td className="px-4 py-4 align-top text-slate-500">
                          {new Date(order.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
