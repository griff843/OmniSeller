# OmniSeller

OmniSeller is a monorepo for inventory, listing, order, shipping, and fulfillment workflows.

## Local development baseline

Local development is intentionally independent of hosted Supabase.

- Node 20
- Docker Postgres on `localhost:5432`
- Docker Redis on `localhost:6379`
- Root env file: `.env`
- Web app: `http://localhost:3000`
- API: `http://localhost:3001`

Supabase storage credentials are optional and only needed when you intentionally test storage-backed photo uploads.

## Prerequisites

- Node 20
- pnpm 8+
- Docker Desktop

## Local setup

1. Install dependencies

```powershell
pnpm install
```

2. Create local env

```powershell
Copy-Item .env.example .env
```

Default local database target:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omniseller?schema=public"
```

Required local variables from `.env.example`:

- `DATABASE_URL` points Prisma and the apps at local Postgres.
- `NEXTAUTH_SECRET` is required by the web app auth configuration.
- `OMNISELLER_API_INTERNAL_SECRET` is required by both apps and authenticates server-to-server API calls. Use a different random value from `NEXTAUTH_SECRET`.
- `NEXT_PUBLIC_APP_URL` identifies the local web app URL.

Production-required provider variables are optional only for local development:

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, and `STORAGE_BUCKET` enable Supabase-backed photo storage and are required outside local development.
- `AUTH0_ISSUER`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH_URL`, and `AUTH_SECRET` configure invitation-only production authentication.
- `OMNISELLER_TOKEN_ACTIVE_KEY_ID` and `OMNISELLER_TOKEN_ENCRYPTION_KEYS` configure versioned provider-token encryption.
- `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`, `EBAY_ENV`, and `EBAY_API_BASE` enable eBay OAuth.
- eBay publication additionally requires `EBAY_MERCHANT_LOCATION_KEY`, `EBAY_PAYMENT_POLICY_ID`, `EBAY_RETURN_POLICY_ID`, and `EBAY_FULFILLMENT_POLICY_ID` from a sandbox seller opted into business policies.
- `EASYPOST_API_KEY` and `DEFAULT_SHIP_FROM_*` enable shipping rate and label purchase flows.
- `OPENAI_API_KEY` enables AI listing suggestions; `OPENAI_MODEL` selects the model.
- `OMNISELLER_API_BASE_URL`, `PORT`, `NODE_ENV`, `REDIS_HOST`, and `REDIS_PORT` can override local app defaults.

3. Start infrastructure

```powershell
docker compose up -d postgres redis
```

4. Prepare Prisma

```powershell
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
```

5. Start the apps

```powershell
pnpm dev
```

## Prisma generate rule on Windows

Run `pnpm db:generate` only when the dev servers are stopped.

Good times to run it:
- after editing `packages/db/prisma/schema.prisma`
- after pulling schema changes from Git
- after a fresh install or dependency refresh

Do not run it while `pnpm dev`, `pnpm --filter api dev`, or `pnpm --filter web dev` are still running. On Windows those processes can keep Prisma engine DLLs locked and cause `EPERM rename ... query_engine-windows.dll.node` failures.

If you hit the guard or a lingering lock:
1. Stop all OmniSeller dev servers.
2. Confirm ports `3000` and `3001` are free.
3. Rerun `pnpm db:generate`.
4. Restart with `pnpm dev`.

Emergency bypass only if you know the client is not in use:

```powershell
$env:OMNISELLER_SKIP_PRISMA_DEV_GUARD="1"
pnpm db:generate
Remove-Item Env:OMNISELLER_SKIP_PRISMA_DEV_GUARD
```

## Useful commands

```powershell
pnpm db:generate
pnpm db:migrate:status
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:push
pnpm db:studio
pnpm dev
pnpm --filter api typecheck
pnpm --filter web typecheck
```

## Local development

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
pnpm verify
```

For the standard Agent-OS and local build verification flow, see
[`docs/runbooks/LOCAL_VERIFICATION.md`](docs/runbooks/LOCAL_VERIFICATION.md).

## Supported beta workflow

- Development credentials exist only outside production. Production uses invitation-only Auth0/OIDC and rejects missing provider configuration at container startup.
- Inventory CRUD, filtering, sorting, local photos, editable listing drafts, readiness, orders, and honest provider-unavailable states are supported.
- Supabase photo storage, OpenAI generation, eBay sandbox publication, and EasyPost sandbox label purchase require their own credentials and external acceptance runs.
- Automatic eBay order polling uses replay-safe checkpoints and reconciliation; real sandbox acceptance still requires seller credentials.
- Production-shape Node containers and a loopback-only staging compose harness are included. No public infrastructure is created automatically.

See [`docs/PRODUCTION_BETA_ACCEPTANCE.md`](docs/PRODUCTION_BETA_ACCEPTANCE.md) for the completion matrix, external acceptance commands, deployment prerequisites, rollback, and known limitations.
See [`docs/PRODUCTION_OPERATIONS.md`](docs/PRODUCTION_OPERATIONS.md) and [`docs/ENDPOINT_AUTHORIZATION_MATRIX.md`](docs/ENDPOINT_AUTHORIZATION_MATRIX.md) for Auth0 provisioning, encryption rotation, deployment operations, and the endpoint audit.

## Historical Agent-OS artifacts

Completed Agent-OS lane, lease, and proof history is retained under `.agent-os/` and `.ops/`. The CLI is intentionally not an application dependency; install it independently before dispatching new lanes. The final queue reconciliation is recorded in `.agent-os/reconciliation/2026-07-15-finalization.md`.

## Notes

- Shipping works locally without EasyPost credentials, but shipping endpoints remain disabled until `EASYPOST_API_KEY` is set.
- Hosted Supabase DB credentials are not required for local development.
- If you later enable Supabase storage, keep it separate from the local database path.
