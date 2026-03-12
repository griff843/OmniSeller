# Run Now - Windows Local Baseline

This repo now uses plain local Docker Postgres + Redis for day-to-day development.

## Bootstrap

```powershell
Copy-Item .env.example .env
docker compose up -d postgres redis
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

## Local targets

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Windows Prisma rule

Run `pnpm db:generate` only when OmniSeller dev servers are stopped.

Safe workflow:
1. `pnpm db:generate`
2. `pnpm db:migrate:deploy`
3. `pnpm dev`

Do not regenerate the Prisma client while `pnpm dev` is still running. On Windows, active Next.js and NestJS processes can keep Prisma engine DLL files open and cause `EPERM rename` failures.

## Recovery if Prisma client generation is locked

1. Stop all OmniSeller dev processes.
2. Confirm nothing is listening on ports `3000` or `3001`.
3. Run:

```powershell
pnpm db:generate
pnpm dev
```

If you intentionally need to bypass the guard:

```powershell
$env:OMNISELLER_SKIP_PRISMA_DEV_GUARD="1"
pnpm db:generate
Remove-Item Env:OMNISELLER_SKIP_PRISMA_DEV_GUARD
```

## Notes

- No Supabase database credentials are required for local development.
- Supabase storage credentials remain optional and out of scope unless you intentionally test storage-backed uploads.
- Shipping credentials remain optional for local boot.
