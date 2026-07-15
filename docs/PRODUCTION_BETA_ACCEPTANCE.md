# OmniSeller production-beta acceptance

Last reconciled: 2026-07-15

## Completion matrix

| Area | Supported state | Evidence/gate | Remaining external work |
| --- | --- | --- | --- |
| Setup | Frozen install, Prisma generate/migrate, deterministic seed | `pnpm install --frozen-lockfile`; isolated empty-database migration and double-seed | Select hosting target |
| Authentication | Protected web routes, development credentials login, API server-to-server secret, ownership filters | unauthenticated redirect; authenticated render; direct API `401`; cross-owner item `404` | Configure a production identity provider |
| Inventory | Create, edit, get, list, filter, sort, workflow derivation | unit tests and persisted live API record after reload | None for supported beta flow |
| Photos | JPEG/PNG/WebP validation, 15 MB limit, local upload/display/reorder/primary/delete | unit tests plus live authenticated local-storage workflow and `200` image retrieval | Supabase credentialed acceptance if remote storage is selected |
| AI drafts | Provider contract, response validation, normalized editable drafts, honest unavailable state | unit tests; live no-key `503` | OpenAI credentialed acceptance |
| Readiness | Derived blockers; listed/sold behavior; publish-attempt truth | unit tests and live ready/listed/sold records | Category-specific eBay requirements remain provider validation |
| eBay publication | OAuth boundary, CSRF state, Inventory API item/offer/publish contract, error normalization, offer reuse | mocked transport tests; live no-token `503` persisted as `UNAVAILABLE` without a listing row | Real sandbox OAuth and publication |
| Orders | Owned list/detail, identifiers, addresses, line items, totals, persisted local fixture | unit tests and live list/detail | Marketplace ingestion/sync is not implemented |
| Shipping | Owned rate/purchase/void boundary, idempotent purchase, persisted errors, honest availability | unit tests; live no-key rate `503`; live purchase `503` persisted as recoverable `UNAVAILABLE` | EasyPost sandbox rate/purchase/void |
| Deployment | Release-readiness workflow only | `.github/workflows/deploy.yml` no longer claims a fake deployment | Choose and configure a production platform |

## Required local environment

Required for the core local stack:

- `DATABASE_URL`
- `NEXTAUTH_SECRET` (or `AUTH_SECRET`)
- `OMNISELLER_API_INTERNAL_SECRET` (independent from the auth secret)
- `OMNISELLER_WEB_ORIGIN` (the exact allowed web origin; comma-separated only when multiple trusted origins are intentional)
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- Postgres and Redis

The root `.env.example` is authoritative. Feature-provider variables are optional; the UI and API report unavailable states when they are absent.

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

The credentials provider refuses production login unless `OMNISELLER_ALLOW_PASSWORDLESS_LOGIN=true`. Do not enable that flag for a public beta. Add and verify an approved OAuth/email provider, then prove sign-in, sign-out, expiry, protected routes, and two-user object isolation.

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

There is no configured production target. Before deployment, select a platform supporting the Next.js web app, Nest API/worker, Postgres, Redis, durable secrets, and public HTTPS image URLs. Apply migrations as a separate release step before starting the new API. Back up Postgres and record the previous web/API artifact IDs.

Rollback application artifacts to the previous version if health checks fail. The publish-state migration only adds an enum and nullable/defaulted columns and is forward-safe; do not automatically roll it back after data has been written. Restore the database only from an explicit backup after owner approval.

## Accepted residual risks and known limitations

- Marketplace order ingestion and webhook verification are not implemented, so the product must not claim automatic order sync.
- Provider tokens are stored in Postgres; production must use encrypted storage or database-level encryption with restricted access.
- There is no production rate limiter or provider webhook endpoint in the supported flow.
- Local photo fallback is development-only and intentionally disabled in production.
- External calls use bounded failures, but full provider success remains credential-gated.
- Browser automation is not part of the repository; local proof used authenticated HTTP rendering and API interactions. Add Playwright coverage before expanding beyond a controlled beta.
