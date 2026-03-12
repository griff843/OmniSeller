'use client';

import { useState } from 'react';
import { Button } from '@omniseller/ui';
import { StatusBadge } from '@/components/shipping/status-badge';
import { type InventoryBin, type InventoryItemDetail, type InventoryStatus, type SaleStatus } from '@/features/inventory/types';

const inventoryStatuses: InventoryStatus[] = ['DRAFT', 'IN_STOCK', 'HOLD', 'ARCHIVED'];
const saleStatuses: SaleStatus[] = ['AVAILABLE', 'LISTED', 'RESERVED', 'SOLD', 'SHIPPED'];

function humanize(value: string) {
  return value.toLowerCase().split('_').map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(' ');
}

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

  if (value === 'ARCHIVED' || value === 'SOLD' || value === 'SHIPPED') {
    return 'neutral' as const;
  }

  return 'danger' as const;
}

export function InventoryControlPanel({
  initialItem,
  bins,
}: {
  initialItem: InventoryItemDetail;
  bins: InventoryBin[];
}) {
  const [item, setItem] = useState(initialItem);
  const [sku, setSku] = useState(initialItem.sku);
  const [title, setTitle] = useState(initialItem.title ?? '');
  const [condition, setCondition] = useState(initialItem.condition ?? '');
  const [binCode, setBinCode] = useState(initialItem.bin?.code ?? '');
  const [upc, setUpc] = useState(initialItem.upc ?? '');
  const [scanCode, setScanCode] = useState(initialItem.scanCode ?? '');
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus>(initialItem.inventoryStatus);
  const [saleStatus, setSaleStatus] = useState<SaleStatus>(initialItem.saleStatus);
  const [saving, setSaving] = useState(false);
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
      // Fall back to the raw text when the response is not JSON.
    }

    return text;
  }

  async function save() {
    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/inventory/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          title,
          condition,
          binCode: binCode || null,
          upc,
          scanCode,
          inventoryStatus,
          saleStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to update inventory item'));
      }

      const updated = (await response.json()) as InventoryItemDetail;
      setItem(updated);
      setSku(updated.sku);
      setTitle(updated.title ?? '');
      setCondition(updated.condition ?? '');
      setBinCode(updated.bin?.code ?? '');
      setUpc(updated.upc ?? '');
      setScanCode(updated.scanCode ?? '');
      setInventoryStatus(updated.inventoryStatus);
      setSaleStatus(updated.saleStatus);
      setFeedback('Inventory controls saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update inventory item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Inventory Control</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{item.sku}</h2>
            <p className="mt-2 text-sm text-slate-600">Manage SKU, storage location, and state without leaving the item workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={badgeTone(item.inventoryStatus)}>{humanize(item.inventoryStatus)}</StatusBadge>
            <StatusBadge tone={badgeTone(item.listingReadiness)}>{humanize(item.listingReadiness)}</StatusBadge>
            <StatusBadge tone={badgeTone(item.saleStatus)}>{humanize(item.saleStatus)}</StatusBadge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>SKU</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={sku} onChange={(event) => setSku(event.target.value)} />
            <div className="text-xs text-slate-500">{item.skuManuallySet ? 'Manual override enabled.' : 'Generated SKU. Editing will lock in a manual SKU.'}</div>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Title</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Condition</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={condition} onChange={(event) => setCondition(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Bin / location</span>
            <input list="inventory-bins" className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="BIN-A1" value={binCode} onChange={(event) => setBinCode(event.target.value)} />
            <datalist id="inventory-bins">
              {bins.map((bin) => <option key={bin.id} value={bin.code}>{bin.code}</option>)}
            </datalist>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>UPC</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={upc} onChange={(event) => setUpc(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Scan code</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={scanCode} onChange={(event) => setScanCode(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Inventory state</span>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={inventoryStatus} onChange={(event) => setInventoryStatus(event.target.value as InventoryStatus)}>
              {inventoryStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Sale state</span>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={saleStatus} onChange={(event) => setSaleStatus(event.target.value as SaleStatus)}>
              {saleStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
            </select>
          </label>
        </div>

        {feedback ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save inventory controls'}</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Workflow Readiness</div>
        <h3 className="mt-2 text-2xl font-semibold text-slate-950">Operator checklist</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="font-medium text-slate-950">Current bin</div>
            <div className="mt-1">{item.bin?.code ?? 'Unassigned'} {item.bin?.area ? ` | ${item.bin.area}` : ''}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="font-medium text-slate-950">Ready photos</div>
            <div className="mt-1">{item.readyPhotoCount} of {item.photoCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="font-medium text-slate-950">Listing workflow</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone={item.workflow.canGenerateAi ? 'success' : 'warning'}>{item.workflow.canGenerateAi ? 'AI ready' : 'AI blocked'}</StatusBadge>
              <StatusBadge tone={item.workflow.canEditDraft ? 'success' : 'warning'}>{item.workflow.canEditDraft ? 'Draft ready' : 'Draft blocked'}</StatusBadge>
              <StatusBadge tone={item.workflow.canPublish ? 'success' : 'warning'}>{item.workflow.canPublish ? 'Publish ready' : 'Publish blocked'}</StatusBadge>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="font-medium text-slate-950">Readiness blockers</div>
            <div className="mt-2 space-y-2">
              {item.workflow.readinessBlockers.length === 0 ? (
                <div className="text-emerald-700">No blockers. This item is ready for the next downstream step.</div>
              ) : (
                item.workflow.readinessBlockers.map((blocker) => <div key={blocker}>{blocker}</div>)
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="font-medium text-slate-950">Scanning foundation</div>
            <div className="mt-1">{item.scanner.note}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
