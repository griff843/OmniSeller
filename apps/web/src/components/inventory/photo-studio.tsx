/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, DragEvent, useRef, useState, useTransition } from 'react';
import { Button } from '@omniseller/ui';
import { StatusBadge, type BadgeTone } from '@/components/shipping/status-badge';
import { InventoryItemDetail, InventoryPhoto, PhotoUploadReservation, formatBytes } from '@/features/inventory/types';
import { putToSignedUrl } from '@/lib/upload';

type UploadQueueItem = {
  localId: string;
  fileName: string;
  status: 'queued' | 'reserving' | 'uploading' | 'finalizing' | 'done' | 'failed';
  error?: string;
};

function getPhotoTone(status: InventoryPhoto['uploadStatus']): BadgeTone {
  switch (status) {
    case 'READY':
      return 'success';
    case 'UPLOADING':
    case 'PROCESSING':
      return 'info';
    case 'FAILED':
      return 'danger';
    default:
      return 'warning';
  }
}

function getPublishTone(status: InventoryItemDetail['publishState']['status']): BadgeTone {
  switch (status) {
    case 'PUBLISHED':
      return 'success';
    case 'QUEUED':
    case 'PROCESSING':
      return 'info';
    case 'FAILED':
    case 'BLOCKED':
      return 'danger';
    case 'UNAVAILABLE':
      return 'warning';
    default:
      return 'neutral';
  }
}

function humanizePublishStatus(status: InventoryItemDetail['publishState']['status']) {
  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
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
    // Fall back to the raw response body.
  }

  return text;
}

async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const imageUrl = URL.createObjectURL(file);
    const image = document.createElement('img');

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to read image dimensions'));
      image.src = imageUrl;
    });

    URL.revokeObjectURL(imageUrl);

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch {
    return {};
  }
}

export function PhotoStudio({ initialItem }: { initialItem: InventoryItemDetail }) {
  const [item, setItem] = useState(initialItem);
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actingPhotoId, setActingPhotoId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function refreshItem() {
    const response = await fetch(`/api/inventory/${item.id}`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const nextItem = (await response.json()) as InventoryItemDetail;
    startRefreshTransition(() => {
      setItem(nextItem);
      window.dispatchEvent(
        new CustomEvent('inventory-item-refreshed', {
          detail: {
            inventoryItemId: nextItem.id,
          },
        }),
      );
    });
  }

  function updateQueue(localId: string, status: UploadQueueItem['status'], errorMessage?: string) {
    setQueue((current) =>
      current.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              status,
              error: errorMessage,
            }
          : entry,
      ),
    );
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'));

    if (files.length === 0) {
      setError('Choose one or more image files to upload.');
      return;
    }

    setError(null);
    setFeedback(null);

    const queueEntries = files.map((file) => ({
      localId: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: file.name,
      status: 'queued' as const,
    }));

    setQueue((current) => [...queueEntries, ...current]);
    queueEntries.forEach((entry) => updateQueue(entry.localId, 'reserving'));

    try {
      const reservationResponse = await fetch(`/api/inventory/${item.id}/photos/upload-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map((file) => ({
            fileName: file.name,
            contentType: file.type || 'image/jpeg',
            sizeBytes: file.size,
          })),
        }),
      });

      if (!reservationResponse.ok) {
        throw new Error(await reservationResponse.text());
      }

      const reservationPayload = (await reservationResponse.json()) as {
        uploads: Array<PhotoUploadReservation & { signedUploadUrl: string; publicUrl: string }>;
      };

      await Promise.all(
        reservationPayload.uploads.map(async (reservation, index) => {
          const queueEntry = queueEntries[index];
          const file = files[index];

          updateQueue(queueEntry.localId, 'uploading');
          await putToSignedUrl(reservation.signedUploadUrl!, file, file.type || 'image/jpeg');

          updateQueue(queueEntry.localId, 'finalizing');
          const dimensions = await readDimensions(file);

          const completeResponse = await fetch(
            `/api/inventory/${item.id}/photos/${reservation.id}/complete`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: reservation.publicUrl,
                width: dimensions.width,
                height: dimensions.height,
              }),
            },
          );

          if (!completeResponse.ok) {
            throw new Error(await completeResponse.text());
          }

          updateQueue(queueEntry.localId, 'done');
        }),
      );

      await refreshItem();
      setFeedback(`Uploaded ${files.length} photo${files.length === 1 ? '' : 's'} successfully.`);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed';
      setError(message);
      setQueue((current) =>
        current.map((entry) =>
          queueEntries.some((queued) => queued.localId === entry.localId) && entry.status !== 'done'
            ? { ...entry, status: 'failed', error: message }
            : entry,
        ),
      );
    }
  }

  async function setPrimary(photoId: string) {
    setActingPhotoId(photoId);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${item.id}/photos/${photoId}/primary`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const nextItem = (await response.json()) as InventoryItemDetail;
      setItem(nextItem);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to set primary photo');
    } finally {
      setActingPhotoId(null);
    }
  }

  async function reorder(photoId: string, direction: -1 | 1) {
    const currentIndex = item.photos.findIndex((photo) => photo.id === photoId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= item.photos.length) {
      return;
    }

    const reordered = [...item.photos];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    setActingPhotoId(photoId);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${item.id}/photos/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: reordered.map((photo) => photo.id) }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const nextItem = (await response.json()) as InventoryItemDetail;
      setItem(nextItem);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to reorder photos');
    } finally {
      setActingPhotoId(null);
    }
  }

  async function deletePhoto(photoId: string) {
    setActingPhotoId(photoId);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${item.id}/photos/${photoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const nextItem = (await response.json()) as InventoryItemDetail;
      setItem(nextItem);
      setFeedback('Photo deleted from the active studio view.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to delete photo');
    } finally {
      setActingPhotoId(null);
    }
  }

  async function publishToEbay() {
    if (!item.workflow.canRequestPublish) {
      setError(
        item.workflow.publishActionBlockedReason ??
          item.workflow.readinessBlockers[0] ??
          'This item is not ready to publish yet.',
      );
      return;
    }

    setIsPublishing(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/listings/${item.id}/publish?marketplace=ebay`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to queue publish'));
      }

      const payload = (await response.json()) as { message?: string };
      setFeedback(payload.message ?? 'Publish was queued for eBay.');
      await refreshItem().catch(() => undefined);
    } catch (publishError) {
      await refreshItem().catch(() => undefined);
      setError(publishError instanceof Error ? publishError.message : 'Failed to queue publish');
    } finally {
      setIsPublishing(false);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      void handleFiles(event.target.files);
      event.target.value = '';
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);

    if (event.dataTransfer.files?.length) {
      void handleFiles(event.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Photo Studio</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">{item.sku}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.title ?? 'Untitled inventory item'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Photos</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{item.photoCount}</div>
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
          {isRefreshing ? <div className="mt-3 text-sm text-slate-500">Refreshing photo state...</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Listing readiness</div>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div>Inventory state: {item.inventoryStatus}</div>
            <div>Readiness: {item.listingReadiness}</div>
            <div className="flex items-center gap-2">
              <span>Publish state:</span>
              <StatusBadge tone={getPublishTone(item.publishState.status)}>
                {humanizePublishStatus(item.publishState.status)}
              </StatusBadge>
            </div>
            <div>Primary photo: {item.primaryPhoto?.originalFileName ?? 'Not set'}</div>
            <div>Latest update: {new Date(item.updatedAt).toLocaleString()}</div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {item.publishState.message}
          </div>
          {!item.workflow.canRequestPublish ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {item.workflow.publishActionBlockedReason ??
                item.workflow.readinessBlockers[0] ??
                'This item is not ready to publish yet.'}
            </div>
          ) : null}
          <Button className="mt-5" onClick={publishToEbay} disabled={isPublishing || !item.workflow.canRequestPublish}>
            {isPublishing
              ? 'Queueing...'
              : item.workflow.canRequestPublish
                ? 'Publish to eBay'
                : item.publishState.isInFlight
                  ? 'Publish in progress'
                  : 'Publish unavailable'}
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          className={`rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${dragActive ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={onDrop}
        >
          <p className="text-lg font-semibold text-slate-950">Drop product photos here</p>
          <p className="mt-2 text-sm text-slate-600">Upload multiple originals at once, or use the file picker for a batch.</p>
          <div className="mt-5 flex justify-center">
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onInputChange} />
            <Button onClick={() => inputRef.current?.click()}>Select images</Button>
          </div>
        </div>

        {queue.length > 0 ? (
          <div className="mt-5 space-y-2">
            {queue.map((entry) => (
              <div key={entry.localId} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{entry.fileName}</div>
                  {entry.error ? <div className="text-rose-600">{entry.error}</div> : null}
                </div>
                <StatusBadge tone={entry.status === 'failed' ? 'danger' : entry.status === 'done' ? 'success' : 'info'}>
                  {entry.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Photo gallery</h3>
            <p className="text-sm text-slate-600">Set a primary image, reorder display sequence, and remove photos from the active item view.</p>
          </div>
        </div>

        {item.photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No photos uploaded yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {item.photos.map((photo, index) => (
              <article key={photo.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="aspect-square bg-slate-100">
                  {photo.url ? (
                    <img src={photo.url} alt={photo.originalFileName ?? item.sku} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Upload pending</div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {photo.isPrimary ? <StatusBadge tone="success">Primary</StatusBadge> : null}
                    <StatusBadge tone={getPhotoTone(photo.uploadStatus)}>{photo.uploadStatus}</StatusBadge>
                    <StatusBadge tone="neutral">#{index + 1}</StatusBadge>
                  </div>
                  <div>
                    <div className="font-medium text-slate-950">{photo.originalFileName ?? 'Unnamed image'}</div>
                    <div className="text-sm text-slate-500">{formatBytes(photo.fileSizeBytes)}{photo.width && photo.height ? ` · ${photo.width} x ${photo.height}` : ''}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
                    <div>{photo.storageBucket}</div>
                    <div className="break-all">{photo.storageKey}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setPrimary(photo.id)} disabled={actingPhotoId === photo.id || photo.isPrimary}>
                      {photo.isPrimary ? 'Primary' : 'Make primary'}
                    </Button>
                    <Button variant="outline" onClick={() => deletePhoto(photo.id)} disabled={actingPhotoId === photo.id}>
                      Delete
                    </Button>
                    <Button variant="outline" onClick={() => reorder(photo.id, -1)} disabled={actingPhotoId === photo.id || index === 0}>
                      Move earlier
                    </Button>
                    <Button variant="outline" onClick={() => reorder(photo.id, 1)} disabled={actingPhotoId === photo.id || index === item.photos.length - 1}>
                      Move later
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

