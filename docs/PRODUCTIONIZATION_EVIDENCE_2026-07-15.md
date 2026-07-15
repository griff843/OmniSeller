# Productionization evidence — 2026-07-15

This packet records the reproducible local evidence for branch
`codex/production-beta-finalization`. It intentionally distinguishes local and
mocked-provider proof from credentialed external acceptance.

## Repository verification

| Gate | Command/evidence | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | Passed |
| Prisma generation | `pnpm db:generate` | Passed |
| Full repository gate | `pnpm verify` | Passed: lint, generated-client typecheck, 13 suites/71 tests, web build, API build |
| Browser acceptance | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm test:e2e` | Passed: 3/3 Chromium and mobile-Chromium tests |
| Diff integrity | `git diff --check` | Passed |

The browser run used disposable PostgreSQL and Redis services plus the real web
and API applications. It covered the login boundary, malformed sessions,
logout, two authenticated seller contexts, object-level isolation, inventory
create/edit/validation, photo upload/display/reload/reorder/delete, manual
listing editing, unavailable AI/provider states, refresh persistence, responsive
navigation, keyboard focus, and automated Axe checks.

## Database and workflow evidence

- Empty database: all three committed migrations applied and Prisma reported the
  schema current; deterministic seed completed.
- Prior-schema database: the two pre-productionization migrations were applied,
  a legacy plaintext marketplace account was inserted, and the additive
  productionization migration applied without data loss. Plaintext token reads
  remain rejected unless the explicit one-time migration flag is enabled.
- eBay ingestion contract: two replays of one sanitized provider order produced
  exactly one order and one line item. The linked inventory transitioned to
  `SOLD`; a cancellation transitioned the order to `CANCELLED` and restored the
  inventory to `LISTED`.
- Concurrent publication claims: two requests produced one queued operation and
  one rejection; only one publish claim was persisted.
- Concurrent EasyPost purchase claims: two requests invoked the provider once
  and persisted one shipment.
- Live ownership probes: Seller A received safe `404` responses when reading or
  mutating Seller B inventory, listing workspace, orders, and shipments. A
  revoked user received `401`.

## Runtime and modest load evidence

- `/health/live` returned `200` independently of dependency readiness.
- `/health/ready` returned `200` only with PostgreSQL and Redis ready.
- A 200-request, concurrency-10 authenticated inventory-list smoke test produced
  zero failures: p50 37 ms, p95 91.9 ms, p99 138 ms. This is a private-beta
  smoke threshold, not a scale claim.
- The web production build keeps Auth.js/`jose` session decoding in the Node
  validation route rather than Edge middleware; the prior Edge
  `CompressionStream` warning is no longer emitted.

## CI history

GitHub Actions run `29438798367` failed typecheck because its job did not run
Prisma generation, so Linux checked source against an absent/stale generated
client. The root typecheck command and CI workflow now generate the client
before TypeScript. Replacement run `29442719757` passed lint, typecheck, tests,
and builds.

## External acceptance record

No real provider success is claimed. The following remain credential- or
infrastructure-gated:

| Provider/gate | Missing input | Exact continuation |
| --- | --- | --- |
| Auth0 | Tenant, Regular Web Application credentials, two invited test identities | Configure the callbacks/origin in `PRODUCTION_OPERATIONS.md`, set `AUTH0_*`, invite both emails, then rerun the browser isolation checklist against staging |
| Supabase Storage | Project URL, service key, bucket, and production bucket policy | Set `SUPABASE_*`, upload/reload/reorder/primary/delete with Seller A, and prove Seller B cannot retrieve or mutate the object |
| eBay sandbox | Application credentials, sandbox seller, location, and business-policy IDs | Set the documented `EBAY_*` variables, connect the seller, publish once, retry, capture rejection, and ingest the resulting sandbox order |
| EasyPost | Test API key and valid test ship-from address | Set `EASYPOST_API_KEY` and `DEFAULT_SHIP_FROM_*`, rate/buy/reload/retry/void one test shipment |
| Managed staging | Hosting choice and approval, DNS/TLS, secrets, monitoring, incident owner | Deploy the immutable images and one-shot migration using `docker-compose.staging.yml` as the topology reference |
| Backup drill | Approved production-like PostgreSQL target with `pg_dump`/`pg_restore` available | Seed meaningful disposable data, run `scripts/backup-postgres.sh`, alter data, restore to a disposable target, and verify all recorded relationships |

OpenAI is optional: without a key the application returns an honest unavailable
state and manual editing/publishing remains enabled.

## Release interpretation

This branch is an internally verified staging candidate, not a production-ready
release. Promotion remains blocked until production identity, persistent object
storage, eBay/EasyPost sandbox acceptance, approved staging, and the measured
backup/restore drill are complete. PR #3 must remain draft and must not be merged
on the strength of this local packet alone.
