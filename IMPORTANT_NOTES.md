# Important Notes for Omniseller Setup

## Critical: Replace Prisma Schema

The Prisma schema at `packages/db/prisma/schema.prisma` currently contains a **PLACEHOLDER SCHEMA** with basic Auth.js models.

### You mentioned you have a Prisma schema - here's how to add it:

1. Open `packages/db/prisma/schema.prisma`
2. **Keep the generator and datasource blocks** at the top:
   ```prisma
   generator client {
     provider = "prisma-client-js"
     output   = "../src/generated/client"
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. **Replace everything else** with your actual schema
4. If you need Auth.js, keep the User, Account, Session, and VerificationToken models
5. Run these commands:
   ```bash
   pnpm db:generate    # Generate Prisma client
   pnpm db:migrate     # Create migration
   ```

## Database URL Configuration

The default `DATABASE_URL` is configured for local PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omniseller"
```

### For Supabase (as you mentioned):

1. Get your connection string from Supabase dashboard
2. Update `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"

   # For direct connection (migrations):
   DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   ```

3. Update `packages/db/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")  # Add this for migrations
   }
   ```

## Missing Dependencies

After installing dependencies with `pnpm install`, you may need to add:

```bash
# For auth providers (example - add what you need)
pnpm add --filter web next-auth-provider-github
pnpm add --filter web next-auth-provider-google
```

## Next Steps After Setup

1. **Replace Prisma Schema** (see above)
2. **Configure Auth Providers** in `apps/web/src/lib/auth.ts`
3. **Update Environment Variables** in `.env`
4. **Run Initial Migration**: `pnpm db:migrate`
5. **Start Development**: `pnpm dev`

## File Structure Created

```
omniseller/
├── apps/
│   ├── web/                 # Next.js 14 app (port 3000)
│   └── api/                 # NestJS API (port 3001)
├── packages/
│   ├── db/                  # Prisma client
│   ├── config/              # Shared configs
│   └── ui/                  # Shared components
├── .github/workflows/       # CI/CD
├── docker-compose.yml       # PostgreSQL + Redis
├── Makefile                 # Commands
├── .env.example            # Template
├── README.md               # Full docs
├── QUICKSTART.md           # Quick start
└── PROJECT_STRUCTURE.md    # Architecture
```

## Quick Command Reference

```bash
# Setup
pnpm install
cp .env.example .env
make up                    # Start Docker services

# Database
pnpm db:generate           # After schema changes
pnpm db:migrate            # Create migration
pnpm db:studio             # GUI for database

# Development
pnpm dev                   # Start web + api
make dev                   # Same as above

# Production
pnpm build                 # Build all
pnpm lint                  # Check code
pnpm typecheck             # Check types
```

## Technology Choices Implemented

✅ pnpm monorepo with workspaces
✅ Next.js 14 with App Router
✅ TypeScript throughout
✅ Tailwind CSS + shadcn/ui components
✅ Auth.js (NextAuth v5) with Prisma adapter
✅ @t3-oss/env-nextjs for type-safe env vars
✅ NestJS with decorators
✅ Swagger/OpenAPI documentation
✅ Zod validation
✅ Pino logger
✅ BullMQ for job queues
✅ Prisma ORM
✅ Docker Compose (PostgreSQL + Redis)
✅ GitHub Actions CI/CD
✅ Makefile for commands
✅ Shared packages architecture

## Authentication Setup

To add authentication providers, edit `apps/web/src/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  ],
  // ... rest of config
});
```

Then add to `.env`:
```env
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret
GOOGLE_ID=your_google_client_id
GOOGLE_SECRET=your_google_client_secret
```

## API Documentation

Once the API is running, visit:
- **Swagger UI**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/health

## Adding New Features

### New API Endpoint
```bash
cd apps/api
npx nest g module features/products
npx nest g controller features/products
npx nest g service features/products
```

### New Web Page
Create `apps/web/src/app/products/page.tsx`:
```tsx
import { Button } from '@omniseller/ui';

export default function ProductsPage() {
  return <div><Button>Hello</Button></div>;
}
```

### New Shared Component
Create `packages/ui/src/components/card.tsx` and export from `packages/ui/src/index.ts`

## Troubleshooting

### Prisma Client Issues
```bash
pnpm db:generate
```

### Port Conflicts
Change ports in `.env` or kill existing processes

### Docker Issues
```bash
make down
make up
```

### Build Errors
```bash
pnpm clean
pnpm install
pnpm build
```

## Support

- Full documentation: [README.md](./README.md)
- Quick start: [QUICKSTART.md](./QUICKSTART.md)
- Architecture: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

---

**Remember**: Replace the Prisma schema with your actual schema before running migrations!
