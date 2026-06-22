# OMNI-108B Diff Summary

Suppressed stale readiness blockers for already-listed inventory in the pure workflow helper.

Changed files:
- `apps/api/src/inventory/inventory-workflow-state.ts`
- `apps/api/src/inventory/inventory-workflow-state.spec.ts`

Implementation change:
- `buildReadinessBlockers` now returns `[]` when `snapshot.hasActiveListing` is true.

Behavior rationale:
- This aligns blocker output with existing `determineListingReadiness` semantics, which already treats active listings as `LISTED` before checking intake, photo, suggestion, or draft state.

Test added:
- Added a focused active-listing snapshot test that is otherwise missing intake/photo/draft fields.
- The test asserts `determineListingReadiness` remains `LISTED` and `buildReadinessBlockers` returns no blockers.

No inventory persistence, controllers, listing publish behavior, marketplace code, Prisma schema, migrations, auth, payment, or shipping code changed.
