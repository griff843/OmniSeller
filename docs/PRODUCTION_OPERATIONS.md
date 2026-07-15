# Production operations

## Supported topology

The staging candidate uses separate Node 20 web and API containers, PostgreSQL 16, Redis 7, and Supabase Storage. BullMQ workers run inside the API process; repeatable job IDs make scheduler registration safe across restarts. Managed PostgreSQL and Redis are recommended for a real environment. Terminate TLS at the managed ingress and set `OMNISELLER_TRUST_PROXY_HOPS` to the exact ingress hop count.

`docker-compose.staging.yml` is a local production-shape proof harness. It binds web and API to loopback and does not create public or paid infrastructure. Copy `.env.staging.example` to the ignored `.env.staging` only for a disposable environment.

The one-shot `migrate` service must succeed before API startup. `/health/live` proves the process can answer; `/health/ready` separately proves PostgreSQL and Redis availability.

## Auth0 invitation flow

Create an Auth0 Regular Web Application with callback `https://HOST/api/auth/callback/auth0`, logout URL `https://HOST/login`, and web origin `https://HOST`. Use the tenant HTTPS issuer as `AUTH0_ISSUER`. Keep `AUTH_TRUST_HOST` disabled; `AUTH_URL` is the canonical origin.

Pre-provision an invitation before the first Auth0 login:

```bash
pnpm db:user invite seller@example.com
```

Auth.js links the stable Auth0 `(provider, providerAccountId)` account to the unique email-backed application user. Uninvited or disabled users are rejected. Sessions are signed, HTTP-only, Secure, SameSite=Lax JWTs with a 15-minute maximum and five-minute renewal interval.

Emergency revocation:

```bash
pnpm db:user revoke seller@example.com "security incident reference"
```

Every web-to-API request rechecks `User.disabledAt`, so revocation is immediate even if a JWT has not expired. Revoke the Auth0 session and eBay authorization in their consoles as a second containment step. Re-enable only after review with `pnpm db:user enable seller@example.com`.

## Provider-token encryption and rotation

Marketplace access and refresh tokens use AES-256-GCM with a random 96-bit IV and authenticated purpose data. Ciphertext stores its format and key ID; `MarketplaceAccount.tokenKeyId` supports inventory and rotation. Keys live only in `OMNISELLER_TOKEN_ENCRYPTION_KEYS`, for example `{"2026-q3":"BASE64_32_BYTES"}`, and the active ID is set separately.

Rotation procedure:

1. Add the new key without removing the old key and deploy it to every API instance.
2. Set `OMNISELLER_TOKEN_ACTIVE_KEY_ID` to the new ID.
3. Run `pnpm --filter api tokens:rotate` once and record only its counts.
4. Verify every account has the new `tokenKeyId`, exercise eBay refresh, then remove the old key in a later release.

For a one-time upgrade of historical plaintext rows, take a verified backup and run with `OMNISELLER_ALLOW_PLAINTEXT_TOKEN_MIGRATION=true`. Normal production reads reject legacy plaintext. Never log query results during rotation.

Revocation removes the MarketplaceAccount tokens after revoking authorization at eBay. If a key is compromised, revoke all provider grants, rotate the encryption key, and reconnect each seller.

## Order reconciliation

The eBay Fulfillment API is polled every five minutes. Each cycle overlaps the prior checkpoint by five minutes, caps pagination at 1,000 orders, times out provider calls after 15 seconds, and advances the checkpoint only after all fetched orders reconcile. Each order is committed independently in a serializable transaction. Provider order IDs and line-item IDs are unique, making repeated polls safe. Cancellation returns linked inventory to `LISTED`; active sales mark it `SOLD`.

Use `POST /ebay/orders/sync` for an owner-scoped manual retry. Connection state exposes `PROCESSING`, `READY`, `UNAVAILABLE`, or `FAILED`, last completion time, and a bounded safe error.

## Backup and restore

Run `scripts/backup-postgres.sh` from an approved operations image containing PostgreSQL client tools. It creates a custom-format dump and verifies its catalog. Restore only into a disposable target first:

```bash
DATABASE_URL=postgresql://... scripts/backup-postgres.sh /secure/backup.dump
OMNISELLER_CONFIRM_RESTORE=disposable-target DATABASE_URL=postgresql://... scripts/restore-postgres.sh /secure/backup.dump
```

Validate users, marketplace accounts, inventory, listings, orders, order items, shipments, photos, and migration status. Production recovery objectives for the invitation beta are initially RPO 24 hours and RTO four hours; tighten them after measuring the selected managed database.

## Deployment and rollback

Build immutable images, scan them, run migrations as a one-shot release job, then start API before web. Roll back application images only when migrations are additive and the prior version tolerates new nullable/defaulted columns. Never reverse a migration automatically. Rollback triggers include elevated 5xx rate, failed readiness for five minutes, authorization leakage, duplicate provider writes, or order reconciliation corruption.

Before rollback, stop provider write traffic and workers. After rollback, run order synchronization to reconcile any external success followed by local response loss. The incident owner must be named in the hosting platform before promotion; repository defaults do not invent a person.

## External acceptance blockers

Use `docs/PRODUCTION_BETA_ACCEPTANCE.md` for eBay, EasyPost, Auth0, OpenAI, and Supabase evidence. Request IDs, timestamps, application IDs, and sanitized state may be retained; credentials and raw buyer payloads may not.
