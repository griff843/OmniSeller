import Link from 'next/link';
import { ApiRequestError, fetchApi } from '@/lib/api-base';
import { StatusBadge } from '@/components/shipping/status-badge';
import { formatCents } from '@/features/orders/types';
import {
  type DashboardInventoryPreview,
  type DashboardOrderPreview,
  type DashboardSummary,
  formatDashboardLabel,
} from '@/features/dashboard/types';

export const dynamic = 'force-dynamic';

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
      {detail ? <div className="mt-1 text-sm text-slate-500">{detail}</div> : null}
    </section>
  );
}

function CountRows({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; count: number }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No records yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 text-sm">
              <span className="capitalize text-slate-600">{formatDashboardLabel(row.key)}</span>
              <span className="font-semibold text-slate-950">{row.count}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InventoryQueue({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: DashboardInventoryPreview[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <Link href={href} className="text-xs font-semibold text-sky-700 underline">
          Open
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing needs attention.</p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/inventory/${item.id}`}
              className="block rounded-md border border-slate-100 p-3 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-950">{item.sku}</span>
                <StatusBadge tone={item.publishStatus === 'FAILED' ? 'danger' : 'neutral'}>
                  {formatDashboardLabel(item.publishStatus)}
                </StatusBadge>
              </div>
              <div className="mt-1 truncate text-sm text-slate-600">{item.title ?? 'Untitled item'}</div>
              {item.publishError ? <div className="mt-1 truncate text-xs text-rose-600">{item.publishError}</div> : null}
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function OrderQueue({
  title,
  orders,
  empty,
}: {
  title: string;
  orders: DashboardOrderPreview[];
  empty: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <Link href="/orders" className="text-xs font-semibold text-sky-700 underline">
          Orders
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">{empty}</p>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-md border border-slate-100 p-3 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-950">{order.marketplaceOrderId}</span>
                <span className="text-sm font-semibold text-slate-950">{formatCents(order.totalCents)}</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {order.buyerName ?? 'Customer'} / {order.itemCount} units / {order.firstSku ?? 'No SKU'}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                {order.latestShipmentStatus ? formatDashboardLabel(order.latestShipmentStatus) : 'No shipment'}
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function Dashboard({ summary }: { summary: DashboardSummary }) {
  const roi = summary.profit.roiPercent === null ? '--' : `${summary.profit.roiPercent}%`;
  const profitWindow = `Last ${summary.period.orderWindowDays} days`;

  return (
    <main className="px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Daily dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Today&apos;s operating picture</h1>
            <p className="mt-2 text-sm text-slate-600">
              Last refreshed {new Date(summary.generatedAt).toLocaleString()}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              Inventory
            </Link>
            <Link href="/orders" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Orders
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Inventory value" value={formatCents(summary.inventory.valueCents)} detail={`${summary.inventory.total} items on hand`} />
          <Metric label="Active listings" value={String(summary.listings.active)} detail={formatCents(summary.listings.activeValueCents)} />
          <Metric label="Gross profit" value={formatCents(summary.profit.grossProfitCents)} detail={`${profitWindow} / ROI ${roi}`} />
          <Metric label="Unshipped orders" value={String(summary.orders.requiringShipping)} detail={`${summary.orders.total} orders in window`} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Revenue" value={formatCents(summary.profit.revenueCents)} />
          <Metric label="Fees" value={formatCents(summary.profit.feeCents)} />
          <Metric label="Shipping cost" value={formatCents(summary.profit.shippingCostCents)} />
          <Metric label="Cost basis" value={formatCents(summary.profit.costBasisCents)} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <CountRows title="Readiness pipeline" rows={summary.inventory.readiness} />
          <CountRows title="Sale lifecycle" rows={summary.inventory.saleLifecycle} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Metric label="Listed" value={String(summary.inventory.workflow.listed)} />
          <Metric label="Sold" value={String(summary.inventory.workflow.sold)} />
          <Metric label="Blocked" value={String(summary.inventory.workflow.blocked)} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Recent intake"
            value={String(summary.inventory.intake.recentCreated)}
            detail={`Last ${summary.inventory.intake.recentDays} days`}
          />
          <Metric label="Missing cost" value={String(summary.inventory.intake.missingCostBasis)} detail="Needs profit data" />
          <Metric label="No bin" value={String(summary.inventory.intake.unassignedBin)} detail="Needs location" />
          <Metric
            label="Stale drafts"
            value={String(summary.inventory.intake.staleDraft)}
            detail={`${summary.inventory.intake.staleDraftDays}+ days old`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <OrderQueue title="Recent sales" orders={summary.orders.recentSales} empty="No sales have been imported yet." />
          <OrderQueue title="Orders requiring shipping" orders={summary.orders.shippingQueue} empty="No orders need shipping work." />
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <InventoryQueue title="Needs photos" href="/inventory?listingReadiness=NEEDS_PHOTOS" items={summary.workQueues.needsPhotos} />
          <InventoryQueue title="Ready for AI" href="/inventory?listingReadiness=READY_FOR_AI" items={summary.workQueues.readyForAi} />
          <InventoryQueue title="Ready to publish" href="/inventory?listingReadiness=READY_TO_PUBLISH" items={summary.workQueues.readyToPublish} />
          <InventoryQueue title="Publish blocked" href="/inventory" items={summary.workQueues.publishBlocked} />
          <OrderQueue title="Shipping errors" orders={summary.workQueues.shippingError} empty="No shipping errors are active." />
        </section>
      </div>
    </main>
  );
}

export default async function Home() {
  try {
    const summary = await fetchApi<DashboardSummary>('/dashboard/summary');
    return <Dashboard summary={summary} />;
  } catch (error) {
    const message =
      error instanceof ApiRequestError
        ? `Dashboard analytics could not be loaded from the API (${error.status}). Confirm the API server and database are running, then refresh.`
        : 'Dashboard analytics could not be loaded. Confirm the API server and database are running, then refresh.';

    return (
      <main className="px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-lg border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-rose-600">Dashboard unavailable</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">The command center is not ready yet.</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">{message}</p>
        </div>
      </main>
    );
  }
}
