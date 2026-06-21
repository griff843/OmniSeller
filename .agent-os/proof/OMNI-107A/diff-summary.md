# OMNI-107A Diff Summary

Added focused Jest coverage for `apps/api/src/inventory/inventory-workflow-state.ts`.

Changed files:
- `apps/api/src/inventory/inventory-workflow-state.spec.ts`

Source changes:
- None. The existing helper functions were already exported and testable.

Coverage added:
- SKU normalization for trimming, uppercasing, unsafe character replacement, dash collapse, and edge trimming.
- Generated SKU formatting with UTC date segments, sanitized ID tails, and short-ID left padding.
- Listing readiness transitions for listed, intake, photos, publishable draft, draft/suggestion, and AI-ready states.
- Sale status preservation for `RESERVED`, `SOLD`, and `SHIPPED`, plus active-listing transitions for available/listed items.
- Readiness blocker messages for missing intake, missing photos, and incomplete publishable draft data.
