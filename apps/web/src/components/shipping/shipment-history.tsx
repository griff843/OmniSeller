'use client';

import { Button } from '@omniseller/ui';
import { StatusBadge, type BadgeTone } from '@/components/shipping/status-badge';
import {
  Shipment,
  formatExecutionState,
  formatMoney,
  formatShipmentStatus,
  getShipmentLastError,
  getSyncState,
} from '@/features/orders/types';

function getExecutionTone(status: Shipment['workflow']['status']): BadgeTone {
  switch (status) {
    case 'FULFILLED':
    case 'LABEL_PURCHASED':
      return 'success';
    case 'SYNC_QUEUED':
    case 'PURCHASE_REQUESTED':
      return 'info';
    case 'UNAVAILABLE':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function ShipmentHistory({
  shipments,
  voidingShipmentId,
  onVoid,
}: {
  shipments: Shipment[];
  voidingShipmentId: string | null;
  onVoid: (shipmentId: string) => void;
}) {
  if (shipments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No shipments created for this order yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shipments.map((shipment) => {
        const syncState = getSyncState(shipment);
        const lastError = getShipmentLastError(shipment);

        return (
          <div key={shipment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={getExecutionTone(shipment.workflow.status)}>
                    {formatExecutionState(shipment.workflow.status)}
                  </StatusBadge>
                  <StatusBadge tone="neutral">
                    Record {formatShipmentStatus(shipment.status)}
                  </StatusBadge>
                  <StatusBadge tone={syncState === 'FAILED' || syncState === 'QUEUE_FAILED' ? 'danger' : 'info'}>
                    Sync {syncState.toLowerCase().replace(/_/g, ' ')}
                  </StatusBadge>
                </div>
                <div className="text-sm text-slate-700">
                  <div>{shipment.workflow.message}</div>
                  <div>
                    {shipment.carrier ?? 'Carrier pending'} {shipment.service ? `- ${shipment.service}` : ''}
                  </div>
                  <div>Tracking: {shipment.trackingCode ?? '--'}</div>
                  <div>
                    Label:{' '}
                    {shipment.labelUrl ? (
                      <a className="text-sky-700 underline" href={shipment.labelUrl} target="_blank" rel="noreferrer">
                        Open label
                      </a>
                    ) : (
                      '--'
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-600 md:text-right">
                <div>Rate {formatMoney(shipment.rateAmount, shipment.rateCurrency ?? 'USD')}</div>
                <div>Purchased {shipment.purchasedAt ? new Date(shipment.purchasedAt).toLocaleString() : '--'}</div>
                <div>Shipment ID {shipment.id}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">Parcel</div>
                <div>
                  {shipment.parcelLength ?? '--'} x {shipment.parcelWidth ?? '--'} x {shipment.parcelHeight ?? '--'} in
                </div>
                <div>{shipment.parcelWeightOz ?? '--'} oz</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">Operational state</div>
                <div>Tracking status: {shipment.trackingStatus ?? '--'}</div>
                <div>Last error: {lastError?.message ?? 'None'}</div>
              </div>
            </div>

            {lastError?.details ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {lastError.details}
              </div>
            ) : null}

            {shipment.workflow.canVoid ? (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => onVoid(shipment.id)}
                  disabled={voidingShipmentId === shipment.id}
                >
                  {voidingShipmentId === shipment.id ? 'Voiding...' : 'Void label'}
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
