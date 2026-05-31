# Local Smoke Fixtures

OmniSeller includes deterministic local smoke fixtures so the core seller workflows can be recreated on any machine without manual setup.

## What gets seeded

The seed creates one deterministic user, bins, inventory items, drafts, photos, a marketplace account, one local order, and one persisted unavailable shipment attempt.

Primary fixtures:

- `FIXTURE-EDIT-001`
  - editable inventory item
  - no photos
  - `listingReadiness = NEEDS_PHOTOS`
- `FIXTURE-DRAFT-001`
  - ready photo present
  - saved listing draft exists
  - intentionally incomplete draft so the item stays in `READY_FOR_LISTING`
- `FIXTURE-READY-001`
  - ready photos present
  - complete listing draft exists
  - `listingReadiness = READY_TO_PUBLISH`
  - `publishStatus = UNAVAILABLE` with an honest missing-marketplace-config message
- `FIXTURE-SOLD-001`
  - sold-order fixture item
  - linked listing record exists
  - local order `LOCAL-ORDER-001` references it
  - shipment record persists `UNAVAILABLE` shipping truth

What is intentionally not faked:

- real marketplace publish success
- real EasyPost rate purchase success
- real carrier void success
- hosted Supabase storage

## Commands

Seed into an existing local database:

```powershell
pnpm db:seed
```

Reset the local database, regenerate Prisma client, and reseed the smoke fixtures:

```powershell
pnpm db:reset:local
```

Run `pnpm db:reset:local` with the web and API dev servers stopped, then restart `pnpm dev` after the reset finishes.

Recommended local bootstrap with smoke fixtures:

```powershell
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

## Verification targets

After seeding, verify these pages and states:

1. Inventory list: `http://localhost:3000/inventory`
2. Editable inventory item
   - search for `FIXTURE-EDIT-001`
   - confirm it is editable and still needs photos
3. Draft-state inventory item
   - search for `FIXTURE-DRAFT-001`
   - confirm a listing draft exists and the item is not yet publishable
4. Publishable inventory item
   - search for `FIXTURE-READY-001`
   - confirm ready photos exist
   - confirm listing readiness is `READY_TO_PUBLISH`
   - confirm publish execution state is honest and unavailable without marketplace credentials
5. Orders and shipping fixture
   - open `http://localhost:3000/orders`
   - confirm `LOCAL-ORDER-001` exists
   - confirm fulfillment is shown as unavailable without `EASYPOST_API_KEY`

Useful API checks:

```powershell
curl.exe -s http://localhost:3001/inventory
curl.exe -s http://localhost:3001/orders
curl.exe -s http://localhost:3001/orders/local-order-001
curl.exe -s http://localhost:3001/shipping/order/local-order-001
```

## Notes

- The seed is deterministic and safe to rerun.
- Local upload fixture images are written to `apps/web/public/local-uploads/...`.
- If you want a completely fresh local database, use `pnpm db:reset:local` instead of manually deleting rows.
