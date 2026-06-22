# OMNI-108A Diff Summary

Implemented the minimal content-type normalization fix in `PhotoStoragePathService`.

Changed files:
- `apps/api/src/inventory/photo-storage-path.service.ts`
- `apps/api/src/inventory/photo-storage-path.service.spec.ts`

Implementation change:
- `resolveExtension` now uses `contentType.trim().toLowerCase()` before selecting a fallback extension.

Test added:
- Extended the content-type fallback table to prove `" image/png "` resolves to `png` when the filename extension is missing.

No upload routes, storage provider integration, photo processing, Prisma schema, migrations, auth, payment, or shipping code changed.
