# Smart Inventory Local Test

## Prerequisites

- local database is available
- local API and web app are running
- latest Prisma client is generated
- latest migration is applied if needed

Recommended commands:

- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm --filter api dev`
- `pnpm --filter web dev`

## 1. Prepare Test Inventory Items

1. Open the inventory page.
2. Create one item without entering a SKU.
3. Create one item with a manual SKU.
4. Give at least one item a title and condition.
5. Upload at least one ready photo to one of the items through Photo Studio.

## 2. Verify SKU Behavior

1. Confirm the auto-created item receives a generated SKU in the UI.
2. Open the item detail page.
3. Edit the SKU and save.
4. Confirm the new normalized SKU persists after refresh.

Suggested verification query:

```sql
select id, sku, "skuManuallySet", "inventoryStatus", "listingReadiness", "saleStatus"
from "InventoryItem"
order by "createdAt" desc;
```

## 3. Assign And Move Bins

1. Open an inventory detail page.
2. Enter a new bin code such as `BIN-A1` and save.
3. Confirm the item now shows the bin on both detail and inventory list pages.
4. Change the bin to another code such as `BIN-B4` and save.
5. Clear the bin field and save to confirm unassignment works.

Suggested verification queries:

```sql
select id, code, label, area, note, "isActive"
from "Bin"
order by code;
```

```sql
select id, sku, "binId"
from "InventoryItem"
order by "updatedAt" desc;
```

## 4. Validate Search And Filters

1. Use the inventory list search box to search by:
   - SKU
   - title
   - brand or model if present
   - UPC
   - scan code
2. Filter by bin.
3. Filter by inventory state.
4. Filter by readiness state.
5. Filter by sale state.
6. Change sort order and confirm the list refreshes correctly.

## 5. Validate Detail Editing

1. On the inventory detail page, update:
   - SKU
   - title
   - condition
   - UPC
   - scan code
   - inventory state
   - sale state
2. Save the changes.
3. Refresh the page and confirm all values persist.

## 6. Verify Readiness State In UI

1. Use an item with no title or condition and confirm it shows `Needs Intake`.
2. Add title and condition but no photos and confirm it shows `Needs Photos`.
3. Add a ready photo and confirm it shows `Ready For AI`.
4. Generate AI suggestions or save a partial draft and confirm it moves to `Ready For Listing`.
5. Save a complete draft with title, description, category, and price and confirm it moves to `Ready To Publish`.
6. Publish the listing and confirm it moves to `Listed`.

## 7. Verify Bin And Readiness In Database

```sql
select
  i.id,
  i.sku,
  i."inventoryStatus",
  i."listingReadiness",
  i."saleStatus",
  b.code as bin_code,
  i.upc,
  i."scanCode"
from "InventoryItem" i
left join "Bin" b on b.id = i."binId"
order by i."updatedAt" desc;
```

## 8. Validate Scanning Foundation

1. Save a `scanCode` on an inventory item.
2. Search the inventory list by that scan code.
3. Confirm the item is returned.
4. Confirm the detail page shows the scanning foundation note so future scanner flows have a clean boundary.
