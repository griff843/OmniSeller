# Quick Start

This repo assumes a plain local Docker Postgres + Redis stack for day-to-day development.

## Prerequisites

- Node 18
- pnpm 8+
- Docker Desktop

## Bootstrap

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

## Local service targets

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Local env

Use the root `.env` file. The default local database URL is:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omniseller?schema=public"
```

## Prisma generate on Windows

Run `pnpm db:generate` before `pnpm dev`, not during it.

Use it when:
- the Prisma schema changed
- you pulled schema changes
- dependencies were reinstalled

Avoid running it while the web or API dev servers are active. The Prisma wrapper will now block that pattern on Windows because active dev processes commonly lock Prisma engine DLL files and cause `EPERM` rename failures.

Recovery if a lock still happens:

```powershell
# Stop dev servers first, then retry
pnpm db:generate
pnpm dev
```

If you absolutely must bypass the guard:

```powershell
$env:OMNISELLER_SKIP_PRISMA_DEV_GUARD="1"
pnpm db:generate
Remove-Item Env:OMNISELLER_SKIP_PRISMA_DEV_GUARD
```

## Prisma commands

```powershell
pnpm db:generate
pnpm db:migrate:status
pnpm db:migrate:deploy
pnpm db:push
pnpm db:studio
```

Use `pnpm db:push` only as a local recovery/developer sync tool. The intended fresh-machine bootstrap path is `pnpm db:migrate:deploy`.

## Optional services

- Supabase storage credentials are optional and not required for local DB-backed development.
- EasyPost credentials are optional and only required when testing shipping endpoints.
