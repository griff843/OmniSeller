# Photo Workflow Local Test

## Goal
Validate the local V1 photo workflow from inventory item preparation through upload, primary selection, reorder, soft-delete, and UI rendering.

## Prerequisites
- Run from `C:\Users\griff\OneDrive\Desktop\Reseller App\omniseller`
- Ensure Postgres is running and `DATABASE_URL` is configured
- Ensure the following env vars are present for the web app:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE`
  - `STORAGE_BUCKET` (optional if using the default `omniseller-images`)
- Ensure the bucket is publicly readable if you want browser rendering to use the stored public URL directly

## Prepare schema and client
1. Generate Prisma client:
   ```powershell
   pnpm db:generate
   ```
2. Apply the photo migration if needed:
   ```powershell
   pnpm db:migrate
   ```
3. Start the API and web apps:
   ```powershell
   pnpm --filter api dev
   ```
   ```powershell
   pnpm --filter web dev
   ```

## Prepare a test inventory item
1. Create a new item from [http://localhost:3000/inventory](http://localhost:3000/inventory), or use Prisma Studio:
   ```powershell
   pnpm db:studio
   ```
2. Confirm the item exists:
   ```sql
   select id, sku, title, status
   from "InventoryItem"
   order by "createdAt" desc;
   ```

## Upload photos in the UI
1. Open the item detail page from the inventory list.
2. In the photo studio, either:
   - drag and drop multiple image files onto the drop zone, or
   - click `Select images` and choose multiple files
3. Watch the upload queue move through `reserving`, `uploading`, `finalizing`, and `done`.
4. Confirm the gallery renders the uploaded images.

## Verify database rows
1. Query the photo records for the item:
   ```sql
   select id, inventory_item_id, storage_bucket, storage_key, url, role, upload_status, sort, is_primary, original_file_name, mime_type, file_size_bytes, uploaded_at, deleted_at, metadata
   from "Photo"
   where inventory_item_id = 'INVENTORY_ITEM_ID'
   order by sort asc, "createdAt" asc;
   ```
2. Confirm:
   - one row exists per uploaded file
   - `upload_status = READY`
   - `storage_key` follows the deterministic inventory path convention
   - the first uploaded photo is primary if no prior photos existed
   - `metadata.pipeline.ingestion.state = READY`

## Verify storage paths
1. Inspect the `storage_key` values from the SQL query.
2. Confirm they look like:
   `inventory/{sanitized-sku}/{inventoryItemId}/photos/{photoId}/original.{ext}`
3. Confirm the rendered browser image URL matches the stored object path in your public bucket.

## Set primary photo
1. In the gallery, click `Make primary` on a non-primary photo.
2. Confirm the `Primary` badge moves in the UI.
3. Re-run the SQL query and verify exactly one row has `is_primary = true`.

## Reorder photos
1. Use `Move earlier` / `Move later` in the gallery.
2. Confirm the visual order changes.
3. Re-run the SQL query and verify the `sort` values match the new order.

## Delete a photo
1. Click `Delete` on a photo.
2. Confirm it disappears from the active gallery.
3. Re-run the SQL query and verify:
   - `deleted_at` is populated
   - `upload_status = DELETED`
4. If the deleted photo had been primary, verify another active photo is promoted to `is_primary = true`.

## Validate rendered state in the UI
1. Refresh the item detail page.
2. Confirm:
   - the photo count matches active photos only
   - the primary badge matches the database
   - gallery order matches `sort`
   - deleted photos are hidden
3. Return to [http://localhost:3000/inventory](http://localhost:3000/inventory) and confirm the item card shows the current primary image and photo count.

## Expected failure behavior
- Unsupported/non-image uploads should fail in the browser before reservation completes.
- Reservation or finalize failures should surface in the UI queue/error message and should not be swallowed.
- Deleted photos remain in storage in V1 by design; deletion is a safe soft-delete, not a destructive storage purge.
