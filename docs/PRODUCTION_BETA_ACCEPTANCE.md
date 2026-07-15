# OmniSeller production-beta acceptance

Last reconciled: 2026-07-15

## Completion matrix

| Area | Supported state | Evidence/gate | Remaining external work |
| --- | --- | --- | --- |
| Setup | Frozen install, Prisma generate/migrate, deterministic seed | `pnpm install --frozen-lockfile`; isolated empty-database migration and double-seed | Select hosting target |
| Authentication | Invitation-only Auth0/OIDC provider, development-only credentials, stable adapter identity, immediate disabled-user enforcement | Playwright missing/malformed session and logout; live two-user inventory/listing/order/shipment `404`; revoked user `401` | Real Auth0 tenant login and renewal acceptance |
| Inventory | Create, edit, get, list, filter, sort, workflow derivation | unit tests and persisted live API record after reload | None for supported beta flow |
| Photos | JPEG/PNG/WebP validation, 15 MB limit, tenant paths, Supabase signed upload, remote/local deletion, stale cleanup | unit tests plus Playwright authenticated upload/display/reload | Supabase credentialed cross-seller acceptance |
| AI drafts | Provider contract, response validation, normalized editable drafts, honest unavailable state | unit tests; live no-key `503` | OpenAI credentialed acceptance |
| Readiness | Derived blockers; listed/sold behavior; publish-attempt truth | unit tests and live ready/listed/sold records | Category-specific eBay requirements remain provider validation |
| eBay publication | OAuth boundary, CSRF state, Inventory API item/offer/publish contract, error normalization, offer reuse | mocked transport tests; live no-token `503` persisted as `UNAVAILABLE` without a listing row | Real sandbox OAuth and publication |
| Orders | Automatic five-minute eBay polling, overlap checkpoint, replay-safe upsert, cancellation and sold transitions | mocked HTTP + real PostgreSQL proof: two replays = one order/line; cancellation restores `LISTED` | eBay sandbox order acceptance |
| Shipping | Owned rate/purchase/void boundary, concurrent idempotency claim, persisted errors, honest availability | unit tests; live no-key behavior; concurrency constraint | EasyPost sandbox rate/purchase/void |
| Deployment | Node 20 images, one-shot migration, health/readiness, staging compose, security CI | local API image build and live dependency readiness | Approved managed staging, monitoring, DNS/TLS, restore drill |

## Required local environment

Required for the core local stack:

- `DATABASE_URL`
- `NEXTAUTH_SECRET` (or `AUTH_SECRET`)
- `OMNISELLER_API_INTERNAL_SECRET` (independent from the auth secret)
- `OMNISELLER_WEB_ORIGIN` (the exact allowed web origin; comma-separated only when multiple trusted origins are intentional)
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- Postgres and Redis

The root `.env.example` is authoritative. Auth0, Supabase, eBay, EasyPost, encryption, PostgreSQL, and Redis configuration are required by the production runtime validator. OpenAI remains optional.

## Standard verification

```bash
pnpm install --frozen-lockfile
pnpm db:generate
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/omniseller?schema=public' pnpm db:migrate:deploy
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/omniseller?schema=public' pnpm db:seed
pnpm verify
```

`pnpm verify` runs lint, typecheck, unit tests, and production builds. Use a disposable database when proving migrations from empty. Do not point reset or destructive migration commands at a database containing user data.

## External acceptance gates

### Production identity

Configure the Auth0 Regular Web Application described in `docs/PRODUCTION_OPERATIONS.md`, invite two users with `pnpm db:user invite`, and prove callback, renewal, expiry, logout, revocation, and two-browser isolation. Local OIDC-compatible provider wiring and isolation are proven; no real Auth0 tenant success is claimed.

### eBay sandbox publication

1. Create/obtain an eBay sandbox seller and opt it into business policies.
2. Create sandbox inventory location, payment, return, and fulfillment policies.
3. Set sandbox values for `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`, `EBAY_API_BASE=https://api.sandbox.ebay.com`, `EBAY_ENV=SANDBOX`, `EBAY_MERCHANT_LOCATION_KEY`, and all three policy IDs.
4. Connect through Settings. Confirm OAuth `state` is verified and connection health shows connected.
5. Use a draft with a numeric eBay category ID and at least one public HTTPS image.
6. Publish once. Confirm the eBay sandbox listing exists and the local item persists `PUBLISHED`, marketplace item ID, offer ID, and URL.
7. Retry the request and confirm no duplicate offer/listing is created.
8. Capture the sandbox listing ID and provider response evidence; never use a production seller for this acceptance run.

### EasyPost sandbox

1. Set an EasyPost test key and complete `DEFAULT_SHIP_FROM_*`.
2. Request rates for the seeded local order with a valid parcel.
3. Buy one test label, reload the order, retrieve the label URL, and confirm tracking persistence.
4. Repeat purchase with the same provider shipment/rate IDs and confirm the existing local shipment is returned.
5. Void/refund the test label, reload, and confirm persisted `VOIDED` truth.

### OpenAI and Supabase

- With `OPENAI_API_KEY`, generate a suggestion, validate the stored model/provider/prompt version, edit it, apply selected fields, reload, and exercise malformed-response/failure behavior.
- With Supabase credentials, upload/display/reorder/delete a real object and verify bucket policy. Local fallback proof does not count as Supabase proof.

## Deployment and rollback

Production-shape images and a loopback-only compose harness exist, but no public target is selected. Apply migrations with the one-shot service before API startup. Follow `docs/PRODUCTION_OPERATIONS.md` for backup, rollback triggers, and worker reconciliation.

## Accepted residual risks and known limitations

- Polling, rather than webhooks, is the intentionally supported eBay ingestion mechanism for the invitation beta.
- Provider tokens are AES-256-GCM encrypted; the deployment key manager and live rotation still require staging acceptance.
- Redis limits protect provider writes and fail closed in production. Auth0 owns authentication-attempt throttling.
- Local photo fallback is development-only and intentionally disabled in production.
- External calls use bounded failures, but full provider success remains credential-gated.
- Playwright covers the deterministic local boundary; real Auth0, Supabase, eBay, and EasyPost successes remain credential-gated.
