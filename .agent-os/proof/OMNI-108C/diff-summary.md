# OMNI-108C Diff Summary

Normalized inventory list sort values before selecting Prisma order clauses.

Changed files:
- `apps/api/src/inventory/inventory.service.ts`
- `apps/api/src/inventory/inventory.service.spec.ts`

Implementation change:
- `buildListSort` now switches on `sort?.trim()` so padded direct service inputs like `" sku-asc "` use the same order behavior as normalized controller inputs.

Test added:
- Updated the existing inventory list/filter test to pass `" sku-asc "` and continue asserting `orderBy: [{ sku: 'asc' }]`.

No inventory write workflows, controllers, marketplace publish behavior, Prisma schema, migrations, auth, payment, or shipping code changed.
