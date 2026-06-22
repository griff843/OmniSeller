# OMNI-107C Diff Summary

Added focused Jest coverage for listing draft item-specifics normalization in `apps/api/src/listings/listing-ai.service.ts`.

Changed files:
- `apps/api/src/listings/listing-ai.service.spec.ts`

Source changes:
- None. The existing `updateDraft` behavior was directly testable through `ListingAiService`.

Coverage added:
- Trims manual item-specifics keys and values before saving.
- Drops item-specifics with blank keys.
- Drops item-specifics with blank values after trimming.
- Preserves meaningful trimmed values, including the string value `0`.
- Verifies omitted `itemSpecifics` does not send an overwrite in the draft update payload.
