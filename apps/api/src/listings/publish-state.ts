export const PUBLISH_STATE_ORDER = [
  'NOT_REQUESTED',
  'BLOCKED',
  'QUEUED',
  'PROCESSING',
  'UNAVAILABLE',
  'FAILED',
  'PUBLISHED',
] as const;

export type PublishExecutionStatusValue = (typeof PUBLISH_STATE_ORDER)[number];

export type PublishStateSnapshot = {
  status?: PublishExecutionStatusValue | null;
  marketplace?: string | null;
  error?: string | null;
  requestedAt?: Date | null;
  queuedAt?: Date | null;
  startedAt?: Date | null;
  publishedAt?: Date | null;
  failedAt?: Date | null;
};

export function getPublishStateMessage(snapshot: PublishStateSnapshot): string {
  const marketplace = (snapshot.marketplace ?? 'marketplace').toUpperCase();
  const status = snapshot.status ?? 'NOT_REQUESTED';

  switch (status) {
    case 'NOT_REQUESTED':
      return 'No publish attempt has been requested yet.';
    case 'BLOCKED':
      return snapshot.error ?? 'This item is currently blocked from publishing.';
    case 'QUEUED':
      return `Publish request queued for ${marketplace}.`;
    case 'PROCESSING':
      return `Publish job is processing for ${marketplace}.`;
    case 'UNAVAILABLE':
      return snapshot.error ?? `${marketplace} publishing is unavailable in this environment.`;
    case 'FAILED':
      return snapshot.error ?? `The most recent ${marketplace} publish attempt failed.`;
    case 'PUBLISHED':
      return `Listing was published to ${marketplace}.`;
    default:
      return 'Publish status is available.';
  }
}

export function isPublishInFlight(status?: PublishExecutionStatusValue | null): boolean {
  return status === 'QUEUED' || status === 'PROCESSING';
}
