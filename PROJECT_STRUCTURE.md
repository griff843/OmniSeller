# Omniseller Project Structure

## Directory Overview

```
omniseller/
├── apps/                       # Application packages
│   ├── web/                   # Next.js 14 frontend
│   │   ├── src/
│   │   │   ├── app/          # App Router pages & layouts
│   │   │   │   ├── api/      # API routes (Auth)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   └── globals.css
│   │   │   ├── components/   # React components
│   │   │   └── lib/          # Utilities
│   │   │       ├── auth.ts   # Auth.js configuration
│   │   │       └── env.ts    # Environment validation
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                   # NestJS backend
│       ├── src/
│       │   ├── common/       # Shared utilities
│       │   ├── config/       # Configuration modules
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   └── main.ts       # Application entry
│       ├── test/             # E2E tests
│       ├── nest-cli.json
│       ├── tsconfig.json
│       └── package.json
│
├── packages/                  # Shared packages
│   ├── db/                   # Prisma database client
│   │   ├── prisma/
│   │   │   ├── schema.prisma # Database schema
│   │   │   └── seed.ts       # Seed data
│   │   ├── src/
│   │   │   ├── generated/    # Generated Prisma client (gitignored)
│   │   │   └── index.ts      # Prisma client singleton
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── config/               # Shared configurations
│   │   ├── tsconfig.base.json       # Base TypeScript config
│   │   ├── tsconfig.nextjs.json     # Next.js specific
│   │   ├── tsconfig.node.json       # Node.js specific
│   │   ├── eslint-preset.js         # Base ESLint config
│   │   ├── eslint-nextjs.js         # Next.js ESLint config
│   │   └── package.json
│   │
│   └── ui/                   # Shared React components
│       ├── src/
│       │   ├── components/   # UI components
│       │   │   └── button.tsx
│       │   ├── lib/
│       │   │   └── utils.ts  # Utility functions (cn, etc.)
│       │   └── index.ts      # Public exports
│       ├── tsconfig.json
│       └── package.json
│
├── .github/
│   └── workflows/            # CI/CD pipelines
│       ├── ci.yml           # Continuous Integration
│       └── deploy.yml       # Deployment workflow
│
├── .vscode/                  # VS Code settings
│   ├── settings.json        # Editor settings
│   └── extensions.json      # Recommended extensions
│
├── docker-compose.yml        # Docker services (Postgres, Redis)
├── Makefile                  # Development commands
├── turbo.json               # Turborepo configuration
├── pnpm-workspace.yaml      # pnpm workspace config
├── package.json             # Root package.json
├── .gitignore
├── .prettierrc
├── .prettierignore
├── .editorconfig
├── .nvmrc
├── .node-version
├── .env.example             # Environment template
├── README.md                # Full documentation
├── QUICKSTART.md           # Quick start guide
└── PROJECT_STRUCTURE.md    # This file
```

## Package Dependencies

### apps/web
- **Dependencies**: Next.js 14, React 18, Auth.js, Prisma Client, @t3-oss/env-nextjs
- **Workspace deps**: @omniseller/db, @omniseller/ui
- **Dev dependencies**: TypeScript, Tailwind CSS, ESLint, Autoprefixer

### apps/api
- **Dependencies**: NestJS 10, BullMQ, Prisma Client, Pino, Zod
- **Workspace deps**: @omniseller/db
- **Dev dependencies**: TypeScript, Jest, Supertest, ts-node

### packages/db
- **Dependencies**: @prisma/client
- **Dev dependencies**: Prisma CLI, TypeScript

### packages/config
- **Dev dependencies**: TypeScript, ESLint, Prettier configs

### packages/ui
- **Dependencies**: Radix UI, class-variance-authority, clsx, tailwind-merge
- **Peer dependencies**: React 18, React DOM 18

## Key Configuration Files

### Root Level
- `package.json` - Workspace scripts and dependencies
- `pnpm-workspace.yaml` - Defines monorepo packages
- `turbo.json` - Build caching and pipeline config
- `.env.example` - Environment variable template
- `Makefile` - Development shortcuts

### Web App (apps/web)
- `next.config.mjs` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS theme
- `src/lib/auth.ts` - Auth.js setup
- `src/lib/env.ts` - Type-safe environment variables

### API (apps/api)
- `nest-cli.json` - NestJS CLI configuration
- `src/main.ts` - Bootstrap, Swagger, validation pipes
- `src/app.module.ts` - Root module with BullMQ, Pino, Config

### Database (packages/db)
- `prisma/schema.prisma` - Database schema
- `src/index.ts` - Prisma client singleton

## Workspace Architecture

### Monorepo Strategy
- **Tool**: pnpm workspaces
- **Build cache**: Turbo
- **Package naming**: `@omniseller/[package-name]`
- **Dependency linking**: `workspace:*` protocol

### Build Order
1. `packages/config` - No build step
2. `packages/db` - Generate Prisma client
3. `packages/ui` - Compile TypeScript
4. `apps/web` - Build Next.js app
5. `apps/api` - Build NestJS app

### Development Mode
- All packages run in watch mode
- Web: `next dev` on port 3000
- API: `nest start --watch` on port 3001
- Hot reload enabled for all packages

## Environment Variables

### Required for Web
- `DATABASE_URL` - Postgres connection
- `NEXTAUTH_SECRET` - Auth.js secret
- `NEXTAUTH_URL` - App URL
- `NEXT_PUBLIC_APP_URL` - Public app URL

### Required for API
- `DATABASE_URL` - Postgres connection
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port
- `PORT` - API port (default 3001)

## Docker Services

### PostgreSQL
- **Image**: postgres:16-alpine
- **Port**: 5432
- **Credentials**: postgres/postgres
- **Database**: omniseller
- **Volume**: postgres-data

### Redis
- **Image**: redis:7-alpine
- **Port**: 6379
- **Persistence**: AOF enabled
- **Volume**: redis-data

## Scripts Reference

### Root Level
```bash
pnpm install      # Install all dependencies
pnpm dev          # Start web + api in dev mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages
pnpm test         # Test all packages
pnpm clean        # Clean all artifacts
```

### Database
```bash
pnpm db:generate  # Generate Prisma client
pnpm db:migrate   # Create and run migration
pnpm db:push      # Push schema (dev only)
pnpm db:studio    # Open Prisma Studio
```

### Makefile Shortcuts
```bash
make up           # Start Docker services
make down         # Stop Docker services
make dev          # Start development
make build        # Build everything
make db:migrate   # Run migrations
make db:studio    # Open Prisma Studio
```

## Tech Stack Summary

### Frontend (apps/web)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth**: Auth.js (NextAuth v5)
- **Validation**: Zod + @t3-oss/env-nextjs
- **Database**: Prisma Client

### Backend (apps/api)
- **Framework**: NestJS 10
- **Language**: TypeScript
- **API Docs**: Swagger/OpenAPI
- **Validation**: Zod + class-validator
- **Logger**: Pino
- **Queue**: BullMQ
- **Database**: Prisma Client

### Infrastructure
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **Container**: Docker Compose
- **CI/CD**: GitHub Actions
- **Monorepo**: pnpm workspaces + Turbo

## Adding New Features

### New API Endpoint
1. Create module: `nest g module features/users`
2. Create controller: `nest g controller features/users`
3. Create service: `nest g service features/users`
4. Add Swagger decorators
5. Add Zod validation DTOs

### New Web Page
1. Create route: `apps/web/src/app/my-page/page.tsx`
2. Import UI components from `@omniseller/ui`
3. Use Prisma client from `@omniseller/db`
4. Add server actions if needed

### New Shared Component
1. Create in `packages/ui/src/components/`
2. Export from `packages/ui/src/index.ts`
3. Import in apps: `import { Component } from '@omniseller/ui'`

### Database Schema Change
1. Edit `packages/db/prisma/schema.prisma`
2. Run `pnpm db:generate`
3. Run `pnpm db:migrate` (with migration name)
4. Commit migration files

## Best Practices

1. **Never commit** `.env` files
2. **Always run** `pnpm db:generate` after schema changes
3. **Use migrations** for production schema changes (not `db:push`)
4. **Keep packages independent** - avoid circular dependencies
5. **Export types** from packages for shared type safety
6. **Use workspace protocol** (`workspace:*`) for internal dependencies
7. **Run lint/typecheck** before committing
8. **Write tests** for critical business logic
9. **Document API endpoints** with Swagger decorators
10. **Use environment validation** (env.ts) for type-safe config
