# Photo Domain V1

## Purpose
The photo domain owns inventory-item image records, deterministic storage keys, upload lifecycle state, primary-photo selection, stable ordering, and the foundation for future processing steps such as compression, background removal, and derivative variants.

## Responsibilities
- Reserve photo rows before upload so the database stays authoritative.
- Generate deterministic storage paths from inventory context.
- Persist upload status, metadata, ordering, and primary-photo state.
- Expose UI-ready inventory photo responses.
- Soft-delete photos safely without immediately discarding storage objects.
- Provide a clean boundary for future processing steps without pretending those transforms exist today.

## Storage path rules
- Original uploads use the pattern:
  `inventory/{sanitized-sku}/{inventoryItemId}/photos/{photoId}/original.{ext}`
- The path is deterministic because it is built from the inventory item, the reserved photo id, and the original file extension.
- The current bucket defaults to `omniseller-images` unless `STORAGE_BUCKET` is configured differently.
- Legacy photos keep their existing URL and use a fallback `legacy/{photoId}` storage key after migration.

## Ordering and primary-photo rules
- Each inventory item can have many active photos.
- `sort` controls the stable UI/listing order.
- Exactly one active photo should be primary whenever the item has at least one active photo.
- When the first photo is reserved for an item, it becomes primary automatically.
- Reorder operations update `sort` and preserve the existing primary photo.
- When the primary photo is deleted, the next lowest-sort active photo is promoted.

## Metadata model
Each `Photo` record stores:
- storage bucket and storage key
- public URL once upload is finalized
- upload status
- original file name and MIME type
- file size and optional image dimensions
- role (`ORIGINAL`, `PROCESSED`, `THUMBNAIL`)
- JSON metadata for pipeline state and future transform state

## Upload lifecycle
- `PENDING`: reserved in the database before upload begins
- `UPLOADING`: available for future runtime progress tracking
- `READY`: upload completed and the photo is active in UI/listing workflows
- `PROCESSING`: reserved for future asynchronous transforms
- `FAILED`: upload or ingestion failure recorded in metadata
- `DELETED`: soft-deleted from the active workflow

## Future processing boundaries
- `PhotoStoragePathService` owns deterministic key generation.
- `PhotoProcessingService` owns pipeline metadata shape and future processing handoff boundaries.
- V1 does not perform compression, background removal, or thumbnail generation yet.
- The metadata pipeline state already reserves explicit sections for:
  - ingestion
  - compression
  - background removal
  - variant generation
- Future workers or services can plug into those boundaries without changing the core photo schema.

## Relationship to inventory and listings
- Inventory is the owner of photo records.
- The item detail photo studio mutates photo state only through inventory/photo APIs.
- Listings continue to read inventory photos; V1 keeps the current compatibility path by preserving a `url` field for ready photos.
- The database remains the source of truth for what photos exist, which one is primary, and what order they should appear in.

## Safe deletion behavior
- Deletion is a soft-delete in V1.
- Deleted photos disappear from active inventory responses and UI, but storage objects are retained for operational recovery.
- This avoids destructive mistakes while preserving deterministic storage history and future auditability.
