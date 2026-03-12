import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AiListingPanel } from '@/components/inventory/ai-listing-panel';
import { InventoryControlPanel } from '@/components/inventory/inventory-control-panel';
import { PhotoStudio } from '@/components/inventory/photo-studio';
import { type InventoryBin, type InventoryItemDetail } from '@/features/inventory/types';
import { AiListingWorkspace } from '@/features/listings/types';
import { ApiRequestError, fetchApi } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  let item: InventoryItemDetail;
  let aiWorkspace: AiListingWorkspace;
  let bins: InventoryBin[];

  try {
    [item, aiWorkspace, bins] = await Promise.all([
      fetchApi<InventoryItemDetail>(`/inventory/${params.id}`),
      fetchApi<AiListingWorkspace>(`/listings/${params.id}/ai`),
      fetchApi<InventoryBin[]>('/inventory/bins'),
    ]);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    const message =
      error instanceof ApiRequestError
        ? `Inventory item data could not be loaded from the API (${error.status}). Confirm the API server and database are running, then refresh.`
        : 'Inventory item data could not be loaded. Confirm the API server and database are running, then refresh.';

    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <Link href="/inventory" className="text-sm font-medium text-sky-700 underline">
              Back to inventory
            </Link>
          </div>
          <section className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-600">Inventory detail unavailable</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">This item could not be loaded right now.</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">{message}</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link href="/inventory" className="text-sm font-medium text-sky-700 underline">
            Back to inventory
          </Link>
        </div>
        <InventoryControlPanel initialItem={item} bins={bins} />
        <PhotoStudio initialItem={item} />
        <AiListingPanel inventoryItemId={item.id} initialWorkspace={aiWorkspace} />
      </div>
    </main>
  );
}
