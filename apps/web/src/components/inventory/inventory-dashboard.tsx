'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@omniseller/ui';
import { StatusBadge } from '@/components/shipping/status-badge';
import {
  type InventoryBin,
  type InventoryItemDetail,
  type InventoryListResponse,
  type InventoryStatus,
  type ListingReadiness,
  type SaleStatus,
} from '@/features/inventory/types';

const inventoryStatuses: InventoryStatus[] = ['DRAFT', 'IN_STOCK', 'HOLD', 'ARCHIVED'];
const listingReadinesses: ListingReadiness[] = ['NEEDS_INTAKE', 'NEEDS_PHOTOS', 'READY_FOR_AI', 'READY_FOR_LISTING', 'READY_TO_PUBLISH', 'LISTED'];
const saleStatuses: SaleStatus[] = ['AVAILABLE', 'LISTED', 'RESERVED', 'SOLD', 'SHIPPED'];

function badgeTone(value: string) {
  if (value === 'READY_TO_PUBLISH' || value === 'LISTED' || value === 'IN_STOCK' || value === 'AVAILABLE') {
    return 'success' as const;
  }

  if (value === 'READY_FOR_AI' || value === 'READY_FOR_LISTING') {
    return 'info' as const;
  }

  if (value === 'HOLD' || value === 'RESERVED') {
    return 'warning' as const;
  }

  if (value === 'SOLD' || value === 'SHIPPED' || value === 'ARCHIVED') {
    return 'neutral' as const;
  }

  return 'danger' as const;
}

function humanize(value: string) {
  return value.toLowerCase().split('_').map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(' ');
}

export function InventoryDashboard({
  initialItems,
  bins,
}: {
  initialItems: InventoryItemDetail[];
  bins: InventoryBin[];
}) {
  const [items, setItems] = useState(initialItems);
  const [binOptions, setBinOptions] = useState(bins);
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [binCode, setBinCode] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('');
  const [listingReadiness, setListingReadiness] = useState('');
  const [saleStatus, setSaleStatus] = useState('');
  const [sort, setSort] = useState('created-desc');
  const [createBinCode, setCreateBinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function readErrorMessage(response: Response, fallback: string) {
    const text = await response.text();

    if (!text) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) {
        return parsed.message.join(', ');
      }

      if (typeof parsed.message === 'string' && parsed.message.length > 0) {
        return parsed.message;
      }
    } catch {
      // Fall back to the raw response text when it is not JSON.
    }

    return text;
  }

  useEffect(() => {
    async function runRefresh() {
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (binCode) params.set('binCode', binCode);
        if (inventoryStatus) params.set('inventoryStatus', inventoryStatus);
        if (listingReadiness) params.set('listingReadiness', listingReadiness);
        if (saleStatus) params.set('saleStatus', saleStatus);
        if (sort) params.set('sort', sort);

        const [inventoryResponse, binsResponse] = await Promise.all([
          fetch(`/api/inventory?${params.toString()}`, { cache: 'no-store' }),
          fetch('/api/inventory/bins', { cache: 'no-store' }),
        ]);

        if (!inventoryResponse.ok) {
          throw new Error(await readErrorMessage(inventoryResponse, 'Failed to load inventory'));
        }

        if (!binsResponse.ok) {
          throw new Error(await readErrorMessage(binsResponse, 'Failed to load bins'));
        }

        const payload = (await inventoryResponse.json()) as InventoryListResponse;
        const nextBins = (await binsResponse.json()) as InventoryBin[];
        setItems(payload.items);
        setBinOptions(nextBins);
        setError(null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    }

    void runRefresh();
  }, [q, binCode, inventoryStatus, listingReadiness, saleStatus, sort]);

  async function createItem() {
    setCreating(true);
    setError(null);
    setFeedback(null);

    try {
      if (!sku.trim() && !title.trim() && !createBinCode.trim()) {
        throw new Error('Enter at least a title, manual SKU, or initial bin before creating an item.');
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku.trim() || undefined,
          title: title.trim() || undefined,
          binCode: createBinCode.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to create inventory item'));
      }

      const created = (await response.json()) as InventoryItemDetail;

      setSku('');
      setTitle('');
      setCreateBinCode('');
      setFeedback(`Created ${created.sku}.`);
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      if (created.bin && !binOptions.some((bin) => bin.id === created.bin?.id)) {
        setBinOptions((current) => [...current, created.bin as InventoryBin].sort((a, b) => a.code.localeCompare(b.code)));
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create inventory item');
    } finally {
      setCreating(false);
    }
  }

  const isFiltered = Boolean(q || binCode || inventoryStatus || listingReadiness || saleStatus);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Warehouse Control</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Smart inventory</h1>
            <p className="mt-2 text-sm text-slate-600">Track storage, listing readiness, and sale state in one operator view.</p>
          </div>
          <Link href="/orders" className="text-sm font-medium text-sky-700 underline">
            Open orders
          </Link>
        </div>

        <section className="grid gap-4 xl:grid-cols-[1.1fr,1.4fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">New intake</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Create inventory item</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Optional manual SKU" value={sku} onChange={(event) => setSku(event.target.value)} />
              <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Initial bin (optional)" value={createBinCode} onChange={(event) => setCreateBinCode(event.target.value)} />
            </div>
            <div className="mt-3 text-sm text-slate-500">Leave SKU blank to generate a deterministic inventory SKU automatically.</div>
            <div className="mt-4 flex justify-end">
              <Button onClick={createItem} disabled={creating}>
                {creating ? 'Creating...' : 'Add inventory item'}
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Filters</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Find stock fast</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Search SKU, title, brand, UPC, scan code" value={q} onChange={(event) => setQ(event.target.value)} />
              <select className="rounded-xl border border-slate-300 px-3 py-2" value={binCode} onChange={(event) => setBinCode(event.target.value)}>
                <option value="">All bins</option>
                {binOptions.map((bin) => (
                  <option key={bin.id} value={bin.code}>{bin.code}</option>
                ))}
              </select>
              <select className="rounded-xl border border-slate-300 px-3 py-2" value={inventoryStatus} onChange={(event) => setInventoryStatus(event.target.value)}>
                <option value="">All inventory states</option>
                {inventoryStatuses.map((status) => (
                  <option key={status} value={status}>{humanize(status)}</option>
                ))}
              </select>
              <select className="rounded-xl border border-slate-300 px-3 py-2" value={listingReadiness} onChange={(event) => setListingReadiness(event.target.value)}>
                <option value="">All readiness states</option>
                {listingReadinesses.map((status) => (
                  <option key={status} value={status}>{humanize(status)}</option>
                ))}
              </select>
              <select className="rounded-xl border border-slate-300 px-3 py-2" value={saleStatus} onChange={(event) => setSaleStatus(event.target.value)}>
                <option value="">All sale states</option>
                {saleStatuses.map((status) => (
                  <option key={status} value={status}>{humanize(status)}</option>
                ))}
              </select>
              <select className="rounded-xl border border-slate-300 px-3 py-2" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="created-desc">Newest first</option>
                <option value="updated-desc">Recently updated</option>
                <option value="sku-asc">SKU A-Z</option>
                <option value="sku-desc">SKU Z-A</option>
                <option value="title-asc">Title A-Z</option>
              </select>
            </div>
          </div>
        </section>

        {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {loading ? <div className="text-sm text-slate-500">Refreshing inventory...</div> : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Bin</th>
                  <th className="px-4 py-3">Inventory</th>
                  <th className="px-4 py-3">Readiness</th>
                  <th className="px-4 py-3">Sale</th>
                  <th className="px-4 py-3">Photos</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                      {isFiltered
                        ? 'No inventory items match the current filters.'
                        : 'No inventory items yet. Create your first item from the intake form above.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="flex gap-4">
                          <div className="h-20 w-24 overflow-hidden rounded-2xl bg-slate-100">
                            {item.primaryPhoto?.url ? (
                              <img src={item.primaryPhoto.url} alt={item.sku} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-950">{item.sku}</div>
                            <div className="text-slate-700">{item.title ?? 'Untitled inventory item'}</div>
                            <div className="text-xs text-slate-500">{item.brand ?? 'No brand'} | {item.model ?? 'No model'} | {item.condition ?? 'Condition missing'}</div>
                            {item.scanCode || item.upc ? <div className="text-xs text-slate-500">Scan {item.scanCode ?? '--'} | UPC {item.upc ?? '--'}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div>{item.bin?.code ?? 'Unassigned'}</div>
                        <div className="text-xs text-slate-500">{item.bin?.area ?? 'No area'}</div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge tone={badgeTone(item.inventoryStatus)}>{humanize(item.inventoryStatus)}</StatusBadge></td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <StatusBadge tone={badgeTone(item.listingReadiness)}>{humanize(item.listingReadiness)}</StatusBadge>
                          <div className="text-xs text-slate-500">{item.workflow.canPublish ? 'Publish-ready draft' : item.workflow.readinessBlockers[0] ?? 'Review item details'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge tone={badgeTone(item.saleStatus)}>{humanize(item.saleStatus)}</StatusBadge></td>
                      <td className="px-4 py-4 text-slate-700">{item.readyPhotoCount}/{item.photoCount} ready</td>
                      <td className="px-4 py-4">
                        <Link className="text-sm font-medium text-sky-700 underline" href={`/inventory/${item.id}`}>
                          Open control panel
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
