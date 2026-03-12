# Smart Inventory Domain V1

## Responsibilities

The smart inventory domain is the source of truth for item identity, storage location, listing readiness, and sale lifecycle state. It exists to keep physical stock control and downstream listing workflows aligned without letting UI-only logic become operational truth.

Core responsibilities:

- maintain a stable SKU per inventory item
- track bin or location assignment for physical storage
- expose explicit inventory, readiness, and sale states
- support inventory search and filtering for high-volume operations
- provide the barcode and scan-code foundation for future scanning workflows

## SKU Rules

SKU behavior in V1 is controlled and deterministic:

- every inventory item has a stable SKU
- if an operator does not supply a SKU, the API generates one from item identity and creation date
- generated SKU format is deterministic: `INV-YYYYMMDD-XXXXXX`
- operator edits are allowed, but the edited SKU is normalized and then persisted as a manual override
- manual SKU overrides flip `skuManuallySet` to true so future tooling can distinguish generated versus operator-set values

SKU normalization rules:

- uppercase only
- non-alphanumeric separators collapse into `-`
- leading and trailing separators are trimmed

## Bin And Location Model

`Bin` is now a first-class location record with:

- `code`
- optional `label`
- optional `area`
- optional `note`
- `sortOrder`
- `isActive`

Rules:

- bin codes are unique per user, not globally
- inventory items store a nullable `binId`
- assigning a bin may create the bin if it does not already exist
- clearing a bin assignment removes the `binId` without deleting the bin record

This provides a clean reseller-scale storage foundation without overbuilding warehouse routing.

## Inventory Status And Readiness Model

The model deliberately separates three concerns.

`inventoryStatus` describes physical stock handling:

- `DRAFT`
- `IN_STOCK`
- `HOLD`
- `ARCHIVED`

`listingReadiness` describes downstream listing workflow readiness:

- `NEEDS_INTAKE`
- `NEEDS_PHOTOS`
- `READY_FOR_AI`
- `READY_FOR_LISTING`
- `READY_TO_PUBLISH`
- `LISTED`

`saleStatus` describes commercial lifecycle state:

- `AVAILABLE`
- `LISTED`
- `RESERVED`
- `SOLD`
- `SHIPPED`

This keeps item identity, location, listing readiness, and sale lifecycle distinct and queryable.

## Readiness Rules

Readiness is persisted and recalculated when inventory facts change.

Current progression:

1. `NEEDS_INTAKE`: title or condition is missing
2. `NEEDS_PHOTOS`: intake basics exist but there are no ready photos
3. `READY_FOR_AI`: intake basics and ready photos exist
4. `READY_FOR_LISTING`: AI suggestions or a draft exist, but the draft is not yet publish-ready
5. `READY_TO_PUBLISH`: draft title, description, category, and price exist
6. `LISTED`: at least one listing exists for the inventory item

## Relationship To Photos, AI Drafts, Listings, And Orders

Photos:

- ready, non-deleted photos directly affect readiness
- primary photo remains a UI and storage concern, while photo availability is used for readiness calculations

AI drafts:

- AI suggestions do not overwrite inventory truth
- AI activity can advance readiness from `READY_FOR_AI` to `READY_FOR_LISTING`

Listings:

- publish-path listing creation moves readiness to `LISTED`
- sale status auto-advances between `AVAILABLE` and `LISTED` when appropriate, while later states such as `RESERVED`, `SOLD`, and `SHIPPED` remain operator or order-driven

Orders:

- orders continue to reference inventory items through order items
- this V1 domain lays the foundation for stronger reserved or sold transitions later without changing the inventory model again

## Search And Operator Filters

Inventory list filtering supports:

- SKU
- title
- brand
- model
- UPC
- scan code
- bin code
- inventory status
- listing readiness
- sale status

This keeps the list usable for real warehouse-style lookup and triage.

## Barcode And Scanning Extension Path

The current foundation includes:

- UPC as product barcode data
- `scanCode` as operator or future scanner-facing code
- `InventoryScannerService` as the future lookup boundary

Future extensions can plug into this seam for:

- camera scanning
- hardware scanner input
- UPC enrichment lookups
- label-printing workflows

The important constraint is that scanning integrations should enrich or locate inventory records through this boundary, not bypass database truth or UI workflows.
