# OmniSeller

OmniSeller is a monorepo for inventory, listing, order, shipping, and fulfillment workflows.

## Local development baseline

Local development is intentionally independent of hosted Supabase.

- Node 18
- Docker Postgres on `localhost:5432`
- Docker Redis on `localhost:6379`
- Root env file: `.env`
- Web app: `http://localhost:3000`
- API: `http://localhost:3001`

Supabase storage credentials are optional and only needed when you intentionally test storage-backed photo uploads.

## Prerequisites

- Node 18
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
pnpm db:reset:local
pnpm db:push
pnpm db:studio
pnpm dev
pnpm --filter api typecheck
pnpm --filter web typecheck
```

## Notes

- Shipping works locally without EasyPost credentials, but shipping endpoints remain disabled until `EASYPOST_API_KEY` is set.
- Hosted Supabase DB credentials are not required for local development.
- If you later enable Supabase storage, keep it separate from the local database path.
- Deterministic local smoke fixtures are documented in `docs/runbooks/LOCAL_SMOKE_FIXTURES.md`.
