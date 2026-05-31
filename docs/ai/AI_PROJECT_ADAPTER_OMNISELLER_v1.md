# AI_PROJECT_ADAPTER_OMNISELLER_v1

## Project Identity

OmniSeller is a resale operations system for inventory intake, listing preparation, marketplace publishing, order management, shipping, and business analytics.

The product goal is to become a fast daily operating system for resellers:

- organize inventory and physical locations
- create high-quality marketplace listings
- sync marketplace listings and orders
- manage fulfillment and shipment history
- track profit, ROI, and operational bottlenecks
- support high-volume reseller workflows

## Canonical Documentation

Project-local OmniSeller docs should live under `docs/omniseller/**`.

Current canonical surfaces:

- `docs/omniseller/ELITE_ROADMAP.md`
- `docs/architecture/**`
- `docs/runbooks/**`
- `docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md`
- `docs/ai/AI_SKILL_WAVE_2_PLAN_v1.md`

Portable AI operating docs live under `docs/ai-core/**`. Portable core docs are reusable workflow guidance only; they must not override OmniSeller-specific code, architecture docs, runbooks, or roadmap decisions.

## Truth Hierarchy

When sources conflict, use this order:

1. Checked-in code and schema
2. Passing verification output from local commands
3. OmniSeller docs under `docs/omniseller/**`, `docs/architecture/**`, and `docs/runbooks/**`
4. Project AI docs under `docs/ai/**`
5. Portable AI core docs under `docs/ai-core/**`
6. Conversation memory or ad hoc notes

## Current System Interpretation

The backend foundation is real but not product-complete.

Implemented or partially implemented domains:

- inventory SKU, bin, readiness, and sale lifecycle state
- photo upload lifecycle, deterministic paths, ordering, primary photo behavior
- AI listing suggestions and operator-controlled listing drafts
- listing publish queue and publish state machine
- EasyPost shipping rate, label, void, and persisted shipment state
- eBay fulfillment sync boundary
- order list/detail surfaces backed by persisted orders
- deterministic local smoke fixtures

Important current gaps:

- no real auth provider setup or user isolation
- hardcoded local `dev-user` behavior remains in backend services
- settings page is still a stub
- eBay OAuth token persistence is not complete
- real eBay publish transport is intentionally unavailable
- eBay listing and order import are not implemented
- dashboard analytics and profit reporting are not implemented
- bulk operations and CSV workflows are not implemented
- multi-marketplace cross-listing is not implemented

## Phase Model

OmniSeller should use the phase model in `docs/omniseller/ELITE_ROADMAP.md`.

Current branch closeout focus:

- stabilize local seed and smoke fixtures
- ensure lint, typecheck, tests, and build are healthy
- document current truth and next work

Next product sprint:

- authentication
- user isolation
- global app shell/navigation
- real settings page
- eBay OAuth persistence and connection health

## Domain Boundaries

The following are OmniSeller-specific and must stay project-local:

- inventory status semantics
- listing readiness rules
- sale lifecycle rules
- marketplace publish and sync behavior
- reseller profit and ROI calculations
- shipping workflow state
- marketplace-specific listing fields
- category, item specifics, and pricing logic
- operational dashboard metrics

Portable AI core can provide planning, routing, verification, and handoff patterns, but it must not define reseller business behavior.

## Closeout Standard

Work is complete only when:

- implementation matches the scoped objective
- affected docs are updated
- `pnpm lint` passes
- `pnpm typecheck` passes
- relevant tests pass
- `pnpm build` passes or any environment-only warning is documented
- smoke checks are run when local services are available

For local DB workflows, Docker Postgres and Redis are expected through `docker compose up -d postgres redis`.
