import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FulfillmentPanel } from '@/components/shipping/fulfillment-panel';
import { ApiRequestError, fetchApi } from '@/lib/api-base';
import { Order, formatCents } from '@/features/orders/types';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  let order: Order;

  try {
    order = await fetchApi<Order>(`/orders/${params.id}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    const message =
      error instanceof ApiRequestError
        ? `Order data could not be loaded from the API (${error.status}). Confirm the API server and database are running, then refresh.`
        : 'Order data could not be loaded. Confirm the API server and database are running, then refresh.';

    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <Link href="/orders" className="text-sm font-medium text-sky-700 underline">
              Back to orders
            </Link>
          </div>
          <section className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-600">Order detail unavailable</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">This order could not be loaded right now.</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">{message}</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/orders" className="text-sm font-medium text-sky-700 underline">
              Back to orders
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Order {order.marketplaceOrderId}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {order.marketplaceAccount?.kind ?? order.marketplace} account {order.marketplaceAccount?.nickname ?? 'default'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order total</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{formatCents(order.totalCents)}</div>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Items</h2>
            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-950">{item.inventoryItem?.title ?? 'Untitled item'}</div>
                      <div className="text-sm text-slate-600">SKU {item.inventoryItem?.sku ?? 'unlinked'} · Qty {item.quantity}</div>
                      <div className="text-sm text-slate-500">Marketplace line item {item.marketplaceLineItemId ?? item.listing?.marketplaceItemId ?? '--'}</div>
                    </div>
                    <div className="text-sm font-medium text-slate-900">{formatCents(item.salePriceCents)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Financials</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between"><span>Item total</span><span>{formatCents(order.totalCents)}</span></div>
              <div className="flex items-center justify-between"><span>Shipping charged</span><span>{formatCents(order.shippingCents)}</span></div>
              <div className="flex items-center justify-between"><span>Tax</span><span>{formatCents(order.taxCents)}</span></div>
              <div className="flex items-center justify-between"><span>Fees</span><span>{formatCents(order.feeCents)}</span></div>
            </div>
          </div>
        </section>

        <FulfillmentPanel initialOrder={order} />
      </div>
    </main>
  );
}
