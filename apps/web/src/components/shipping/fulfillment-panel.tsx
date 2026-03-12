'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@omniseller/ui';
import {
  Order,
  ShippingRateResponse,
  formatExecutionState,
  formatMoney,
  formatShipmentStatus,
  getLatestShipment,
} from '@/features/orders/types';
import { StatusBadge, type BadgeTone } from '@/components/shipping/status-badge';
import { ShipmentHistory } from '@/components/shipping/shipment-history';

type ParcelFormState = {
  length: string;
  width: string;
  height: string;
  weightOz: string;
};

const defaultParcel: ParcelFormState = {
  length: '12',
  width: '9',
  height: '4',
  weightOz: '16',
};

function getExecutionTone(status: Order['fulfillment']['status'] | Order['shipments'][number]['workflow']['status']): BadgeTone {
  if (status === 'FULFILLED' || status === 'LABEL_PURCHASED') return 'success';
  if (status === 'SYNC_QUEUED' || status === 'PURCHASE_REQUESTED') return 'info';
  if (status === 'FAILED') return 'danger';
  if (status === 'UNAVAILABLE') return 'warning';
  return 'neutral';
}

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
    // Keep the raw response body fallback.
  }

  return text;
}

export function FulfillmentPanel({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);
  const [parcel, setParcel] = useState<ParcelFormState>(defaultParcel);
  const [quote, setQuote] = useState<ShippingRateResponse | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [purchasingRateId, setPurchasingRateId] = useState<string | null>(null);
  const [voidingShipmentId, setVoidingShipmentId] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();

  const latestShipment = getLatestShipment(order);

  async function refreshOrder() {
    const response = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Failed to refresh order (${response.status})`));
    }

    const nextOrder = (await response.json()) as Order;
    startRefreshTransition(() => {
      setOrder(nextOrder);
    });
  }

  async function requestRates() {
    if (!order.fulfillment.canRequestRates) {
      setError(order.fulfillment.message);
      return;
    }

    setIsQuoting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/shipping/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcels: [
            {
              length: Number(parcel.length),
              width: Number(parcel.width),
              height: Number(parcel.height),
              weightOz: Number(parcel.weightOz),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to request rates'));
      }

      const nextQuote = (await response.json()) as ShippingRateResponse;
      setQuote(nextQuote);
      setFeedback(`Loaded ${nextQuote.rates.length} live rate option${nextQuote.rates.length === 1 ? '' : 's'}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to request rates');
    } finally {
      setIsQuoting(false);
    }
  }

  async function purchaseRate(rateId: string) {
    if (!quote) {
      return;
    }

    setPurchasingRateId(rateId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/shipping/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerShipmentId: quote.providerShipmentId,
          rateId,
          labelFormat: 'PDF',
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to purchase label'));
      }

      await refreshOrder();
      setQuote(null);
      setFeedback('Shipping action completed. Review the latest shipment state below.');
    } catch (purchaseError) {
      await refreshOrder().catch(() => undefined);
      setError(purchaseError instanceof Error ? purchaseError.message : 'Failed to purchase label');
    } finally {
      setPurchasingRateId(null);
    }
  }

  async function voidShipment(shipmentId: string) {
    setVoidingShipmentId(shipmentId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/shipments/${shipmentId}/void`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to void shipment'));
      }

      await refreshOrder();
      setFeedback('Shipment label voided successfully.');
    } catch (voidError) {
      await refreshOrder().catch(() => undefined);
      setError(voidError instanceof Error ? voidError.message : 'Failed to void shipment');
    } finally {
      setVoidingShipmentId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Fulfillment</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Ship this order</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Request live carrier rates, purchase a label, and verify marketplace sync state without leaving the order.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={getExecutionTone(order.fulfillment.status)}>
                {formatExecutionState(order.fulfillment.status)}
              </StatusBadge>
              {latestShipment ? (
                <StatusBadge tone="neutral">
                  Record {formatShipmentStatus(latestShipment.status)}
                </StatusBadge>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking</div>
              <div className="mt-2 text-sm font-medium text-slate-900">{latestShipment?.trackingCode ?? '--'}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Label</div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {latestShipment?.labelUrl ? (
                  <Link href={latestShipment.labelUrl} target="_blank" className="text-sky-700 underline">
                    Open PDF
                  </Link>
                ) : (
                  '--'
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest shipment</div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {latestShipment ? latestShipment.workflow.message : order.fulfillment.message}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {latestShipment ? new Date(latestShipment.updatedAt).toLocaleString() : new Date(order.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {isRefreshing ? (
            <div className="mt-4 text-sm text-slate-500">Refreshing shipment state...</div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Destination</div>
          <div className="mt-4 space-y-1 text-sm text-slate-700">
            <div className="font-semibold text-slate-950">{order.shippingName ?? order.buyerName ?? 'Customer'}</div>
            {order.shippingCompany ? <div>{order.shippingCompany}</div> : null}
            <div>{order.shippingAddress1 ?? '--'}</div>
            {order.shippingAddress2 ? <div>{order.shippingAddress2}</div> : null}
            <div>
              {order.shippingCity ?? '--'}, {order.shippingState ?? '--'} {order.shippingPostalCode ?? '--'}
            </div>
            <div>{order.shippingCountry ?? '--'}</div>
            {order.buyerEmail ? <div>{order.buyerEmail}</div> : null}
            {order.buyerPhone ? <div>{order.buyerPhone}</div> : null}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {order.fulfillment.message}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Rate request</h3>
            <p className="text-sm text-slate-600">Use the actual package dimensions and weight before buying a label.</p>
          </div>
          <Button
            onClick={requestRates}
            disabled={
              isQuoting ||
              !order.fulfillment.canRequestRates ||
              Object.values(parcel).some((value) => value.trim() === '')
            }
          >
            {isQuoting ? 'Requesting rates...' : order.fulfillment.canRequestRates ? 'Get live rates' : 'Rates unavailable'}
          </Button>
        </div>

        {!order.fulfillment.canRequestRates ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {order.fulfillment.message}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {([
            ['length', 'Length (in)'],
            ['width', 'Width (in)'],
            ['height', 'Height (in)'],
            ['weightOz', 'Weight (oz)'],
          ] as const).map(([key, label]) => (
            <label key={key} className="space-y-2 text-sm font-medium text-slate-700">
              <span>{label}</span>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-500"
                value={parcel[key]}
                onChange={(event) =>
                  setParcel((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {quote?.rates.length ? (
            quote.rates.map((rate) => (
              <div key={rate.rateId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-950">{rate.carrier} {rate.service}</div>
                  <div className="text-sm text-slate-600">
                    {rate.deliveryDays ? `${rate.deliveryDays} business day${rate.deliveryDays === 1 ? '' : 's'}` : 'Transit estimate unavailable'}
                    {rate.estDeliveryDate ? ` · ETA ${new Date(rate.estDeliveryDate).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-base font-semibold text-slate-950">{formatMoney(rate.rate, rate.currency)}</div>
                    <div className="text-xs text-slate-500">{rate.provider}</div>
                  </div>
                  <Button
                    onClick={() => purchaseRate(rate.rateId)}
                    disabled={purchasingRateId === rate.rateId || !order.fulfillment.canPurchaseLabels}
                  >
                    {purchasingRateId === rate.rateId ? 'Purchasing...' : 'Buy label'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {isQuoting ? 'Waiting for live carrier pricing...' : 'No rates loaded yet. Enter parcel details and request rates.'}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Shipment history</h3>
            <p className="text-sm text-slate-600">Previously created shipments remain visible here for support and reconciliation.</p>
          </div>
        </div>
        <ShipmentHistory shipments={order.shipments} voidingShipmentId={voidingShipmentId} onVoid={voidShipment} />
      </section>
    </div>
  );
}
