import { InventoryDashboard } from '@/components/inventory/inventory-dashboard';
import { type InventoryBin, type InventoryListResponse } from '@/features/inventory/types';
import { ApiRequestError, fetchApi } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  try {
    const [inventory, bins] = await Promise.all([
      fetchApi<InventoryListResponse>('/inventory'),
      fetchApi<InventoryBin[]>('/inventory/bins'),
    ]);

    return <InventoryDashboard initialItems={inventory.items} bins={bins} />;
  } catch (error) {
    const message =
      error instanceof ApiRequestError
        ? `Inventory could not be loaded from the API (${error.status}). Confirm the API server and database are running, then refresh.`
        : 'Inventory could not be loaded. Confirm the API server and database are running, then refresh.';

    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-600">Inventory unavailable</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">The inventory workspace is not ready yet.</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">{message}</p>
        </div>
      </main>
    );
  }
}
