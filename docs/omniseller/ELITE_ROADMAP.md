# OmniSeller Elite Roadmap

## Current Position

OmniSeller has a solid backend foundation for a reseller operations product:

- Inventory identity, SKU generation, bins, readiness, and sale lifecycle state
- Photo upload lifecycle with deterministic storage paths and ordering
- AI listing suggestion and operator-controlled draft workflow
- Listing publish queue and durable publish state machine
- EasyPost rating, label purchase, void flow, and shipment history
- eBay fulfillment sync boundary for purchased labels
- Local smoke fixtures for repeatable inventory, listing, photo, order, and shipping verification

The project is not yet comparable to mature reseller apps such as Vendoo, List Perfectly, or Crosslist because several production workflows are still missing or intentionally unavailable.

## Agreement With Claude's Analysis

Claude's priority order is mostly correct:

1. Auth, navigation, and settings should come first.
2. Dashboard analytics should follow because sellers need morning operating truth.
3. eBay import should come before marketplace expansion because most users already have active listings and orders.
4. Price intelligence should feed the AI listing workflow.
5. Bulk operations are required for serious reseller throughput.

Two corrections:

- Orders are not full CRUD yet. The current API primarily supports listing and reading orders from persisted data.
- The eBay publish pipeline has a BullMQ queue and state machine, but the real eBay publish transport is still intentionally unavailable.

## Product North Star

Build OmniSeller into a fast daily operating system for resellers:

- intake items quickly
- produce strong listings with AI assistance
- publish and sync marketplace listings
- import existing marketplace activity
- manage inventory locations
- ship orders reliably
- understand profit, ROI, and operational bottlenecks

## Phase 0: Stabilize The Current Branch

Goal: make the current repo baseline trustworthy before adding larger product surface.

Required work:

- Commit or intentionally discard the current seed and smoke-fixture changes.
- Fix `pnpm lint`; `packages/ui` currently cannot resolve the shared ESLint config.
- Fix the React hook dependency warning in `apps/web/src/components/inventory/ai-listing-panel.tsx`.
- Normalize Windows path casing in local workflow docs to avoid `C:\Dev` vs `C:\dev` build warnings.
- Add one smoke command or checklist that proves inventory, listing draft, publish-unavailable, order, and shipping-unavailable states load locally.

Exit criteria:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm build` passes without actionable app warnings.
- `pnpm lint` passes.
- Local smoke fixtures can be recreated with documented commands.

## Phase 1: Make It A Real App

Goal: users can log in, navigate, connect services, and operate inside an authenticated product shell.

Required work:

- Add login page and auth provider configuration.
- Enforce authenticated sessions on app routes and API proxy routes.
- Replace hardcoded `dev-user` backend behavior with real user context.
- Add a global app shell with sidebar or top navigation.
- Replace the settings stub with real settings sections:
  - account
  - marketplace connections
  - shipping provider
  - storage/photo configuration
  - AI provider/model status
- Persist eBay OAuth tokens into `MarketplaceAccount`.
- Add marketplace connection health state and reconnect flow.

Exit criteria:

- A user can sign in and only see their own inventory, listings, orders, bins, photos, and marketplace accounts.
- Settings accurately show whether eBay, EasyPost, storage, and AI are configured.
- eBay OAuth creates or updates a real marketplace account row.

## Phase 2: Daily Reseller Dashboard

Goal: the home page becomes the seller's morning command center.

Required work:

- Replace the static home page with operational analytics.
- Add inventory counts by readiness and sale lifecycle.
- Add listed, sold, shipped, and blocked workflow counts.
- Add revenue, fees, shipping cost, cost basis, gross profit, and ROI summaries.
- Add recent sales and orders requiring shipping.
- Add stuck-work queues:
  - needs photos
  - ready for AI
  - ready to publish
  - publish failed or unavailable
  - shipping error

Exit criteria:

- A seller can open the dashboard and know what needs attention today.
- Profit calculations are traceable to order items, fees, shipping, and inventory cost basis.

## Phase 3: eBay Import And Sync

Goal: OmniSeller can onboard sellers who already have eBay activity.

Required work:

- Import active eBay listings into `Listing` and linked or placeholder inventory records.
- Import eBay orders into `Order` and `OrderItem`.
- Add incremental sync state per marketplace account.
- Add manual refresh and scheduled sync jobs.
- Map imported listing/order data to inventory sale lifecycle.
- Handle deleted, ended, sold, canceled, and changed eBay listings.
- Add conflict handling when imported marketplace data differs from local drafts.

Exit criteria:

- A connected eBay account can pull active listings and recent orders.
- Existing marketplace data appears in inventory, listings, and orders without manual seed data.
- Repeated syncs are idempotent.

## Phase 4: Real eBay Publish

Goal: ready local listing drafts can become real eBay listings.

Required work:

- Implement the eBay publish provider transport.
- Resolve eBay category IDs rather than free-text category strings.
- Validate required eBay item specifics.
- Create or update inventory item, offer, listing, pricing, quantity, and photos through eBay APIs.
- Store marketplace item ID, offer ID, listing URL, and published state.
- Add retry behavior and operator-visible publish failure details.
- Add publish preview before final submission.

Exit criteria:

- A ready item can publish to eBay sandbox or production.
- Published marketplace IDs persist locally.
- Failed publishes explain exactly what the seller must fix.

## Phase 5: Price Intelligence And Listing Quality

Goal: AI listing work becomes materially better than manual draft entry.

Required work:

- Add eBay sold comparable lookup.
- Store comparable search snapshots.
- Feed comps into suggested price and pricing confidence.
- Add title quality checks.
- Add condition and defect disclosure prompts.
- Add category-specific item specifics recommendations.
- Add saved templates per category.

Exit criteria:

- AI suggestions include price rationale and comparable evidence.
- Sellers can apply category-specific templates instead of rebuilding details every time.

## Phase 6: Bulk Operations

Goal: power sellers can move tens or hundreds of items without one-item-at-a-time friction.

Required work:

- Add inventory multi-select and bulk edit.
- Add CSV import for inventory intake.
- Add CSV export for reporting and migration.
- Add bulk AI generation queue.
- Add bulk publish queue.
- Add bulk bin assignment.
- Add bulk status and lifecycle transitions.

Exit criteria:

- A seller can import, enrich, and prepare many items in one workflow.
- Long-running bulk operations have progress, retry, and failure reporting.

## Phase 7: Photo And Intake Upgrades

Goal: item intake becomes mobile-friendly and visually competitive.

Required work:

- Add production storage-backed upload path.
- Generate thumbnails and optimized derivatives.
- Add background removal or background cleanup.
- Add auto-crop and image quality checks.
- Add mobile camera-first upload flow.
- Add barcode or scan-code intake UI.
- Add UPC/product enrichment lookup.
- Add inventory label printing.

Exit criteria:

- A seller can intake an item from a phone with photos, barcode data, bin assignment, and listing-ready facts.
- Photos are optimized for marketplace publishing.

## Phase 8: Shipping And Post-Sale Operations

Goal: shipping and after-sale workflows are dependable enough for daily order volume.

Required work:

- Add address validation.
- Add package presets.
- Add label reprint.
- Add batch label purchase.
- Add tracking refresh.
- Add delivery exception state.
- Add returns workflow.
- Add refunds/cancellations support.
- Add notifications for new orders, shipping failures, and delivery issues.

Exit criteria:

- Sellers can process daily shipments quickly.
- Exceptions are visible before they become customer-service problems.

## Phase 9: Multi-Marketplace Expansion

Goal: OmniSeller becomes a cross-listing platform rather than an eBay tool.

Required work:

- Generalize marketplace account capabilities.
- Add marketplace-specific draft views.
- Add marketplace-specific category and field requirements.
- Add Mercari, Poshmark, Facebook Marketplace, Depop, or other target integrations.
- Add cross-list publish status per marketplace.
- Add delist/sold synchronization across marketplaces.

Exit criteria:

- One inventory item can produce marketplace-specific listing drafts and publish states.
- Sale on one marketplace prevents accidental double-sale elsewhere.

## Phase 10: Production Operations

Goal: the repo is deployable and supportable.

Required work:

- Replace placeholder deploy workflow with real production deployment.
- Add environment validation for web and API.
- Add database backup and migration runbook.
- Add structured logs and error reporting.
- Add basic admin/support views.
- Add audit trail for inventory, listing, order, shipping, and settings mutations.
- Add Playwright end-to-end tests for core workflows.
- Add monitoring for queues, sync jobs, publish failures, and shipping failures.

Exit criteria:

- Production deploys are repeatable.
- Failures are observable.
- Core workflows are covered by automated end-to-end tests.

## Recommended Sprint Order

1. Current branch closeout: lint, warnings, fixture docs, commit.
2. Auth, user isolation, app shell, and settings.
3. eBay OAuth persistence and connection health.
4. Dashboard analytics and profit foundation.
5. eBay order and listing import.
6. Real eBay publish transport.
7. Price intelligence.
8. Bulk operations.
9. Mobile intake, photo upgrades, and barcode workflows.
10. Shipping scale, returns, notifications, and production operations.

## Definition Of Elite

OmniSeller should be considered elite-level only when:

- A new seller can connect eBay and import existing activity.
- A seller can intake an item from phone or desktop.
- AI can create a strong draft using inventory facts, photos, templates, and comps.
- The seller can publish, ship, track, and reconcile orders.
- Profit and ROI are visible without spreadsheets.
- Bulk workflows handle high-volume sellers.
- Marketplace failures are honest, recoverable, and visible.
- The app is secure, multi-user, monitored, and deployable.
