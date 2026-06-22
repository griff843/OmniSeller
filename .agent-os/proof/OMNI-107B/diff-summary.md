# OMNI-107B Diff Summary

Added focused Jest coverage for `apps/api/src/inventory/photo-storage-path.service.ts`.

Changed files:
- `apps/api/src/inventory/photo-storage-path.service.spec.ts`

Source changes:
- None. The existing `buildOriginalPhotoKey` method was already public and directly testable.

Coverage added:
- Deterministic original photo storage key construction.
- SKU path segment sanitization, including whitespace, punctuation, underscores, hyphens, and empty sanitized values.
- Filename extension normalization when a clean extension is present.
- Content-type extension fallback for `image/png`, `image/webp`, `image/heic`, uppercase content types, and default `jpg`.
- Unsafe filename extension fallback to `jpg`.
