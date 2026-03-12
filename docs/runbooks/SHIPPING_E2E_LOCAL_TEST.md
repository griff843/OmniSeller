# Shipping E2E Local Test

## Goal
Validate the full local shipping workflow from rate quote through label purchase, BullMQ sync side effects, and label voiding.

## Prerequisites
- From `C:\Users\griff\OneDrive\Desktop\Reseller App\omniseller`, install dependencies with `pnpm install` if they are not already present.
- Ensure Postgres and Redis are running for the repo's local environment.
- Populate the required shipping and eBay env vars in `.env.local` or `.env`:
  - `DATABASE_URL`
  - `EASYPOST_API_KEY`
  - `DEFAULT_SHIP_FROM_STREET1`
  - `DEFAULT_SHIP_FROM_CITY`
  - `DEFAULT_SHIP_FROM_STATE`
  - `DEFAULT_SHIP_FROM_ZIP`
  - `DEFAULT_SHIP_FROM_COUNTRY`
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `EBAY_CLIENT_ID`
  - `EBAY_CLIENT_SECRET`
  - `EBAY_API_BASE` if you need a non-default target

## Prepare schema
1. Generate Prisma client if needed:
   ```powershell
   pnpm db:generate
   ```
2. Apply the local migration if the shipment columns are not present yet:
   ```powershell
   pnpm db:migrate
   ```
3. Start the API and web apps in separate terminals:
   ```powershell
   pnpm --filter api dev
   ```
   ```powershell
   pnpm --filter web dev
   ```

## Prepare a test order
1. Create or identify an order row with:
   - a valid shipping address
   - at least one order item
   - marketplace line item ids for eBay sync validation
   - a linked marketplace account row when testing eBay sync
2. Example Prisma Studio path:
   ```powershell
   pnpm db:studio
   ```
3. If you prefer SQL, verify the order and related items exist:
   ```sql
   select id, marketplace_order_id, shipping_name, shipping_address1, shipping_city, shipping_state, shipping_postal_code
   from "Order"
   order by "createdAt" desc;
   ```

## Quote rates
1. Replace `ORDER_ID` with the real order id and call the backend directly:
   ```powershell
   curl.exe -X POST http://localhost:3001/shipping/rates ^
     -H "Content-Type: application/json" ^
     -d "{\"orderId\":\"ORDER_ID\",\"parcels\":[{\"length\":12,\"width\":9,\"height\":4,\"weightOz\":16}]}"
   ```
2. Confirm the response contains:
   - `providerShipmentId`
   - one or more `rates[]`
   - carrier/service/rate data

## Purchase label
1. Copy the `providerShipmentId` and one `rateId` from the quote response.
2. Purchase the label:
   ```powershell
   curl.exe -X POST http://localhost:3001/shipping/purchase ^
     -H "Content-Type: application/json" ^
     -d "{\"orderId\":\"ORDER_ID\",\"providerShipmentId\":\"PROVIDER_SHIPMENT_ID\",\"rateId\":\"RATE_ID\",\"labelFormat\":\"PDF\"}"
   ```
3. Validate the response contains:
   - `id`
   - `trackingCode`
   - `labelUrl`
   - `status`

## Verify database rows
1. Check the shipment row after purchase:
   ```sql
   select id, order_id, status, provider_shipment_id, provider_rate_id, tracking_code, label_url, purchased_at, synced_to_marketplace_at, voided_at, metadata
   from "Shipment"
   where order_id = 'ORDER_ID'
   order by "createdAt" desc;
   ```
2. Confirm:
   - one purchased shipment exists for the provider shipment id/rate id pair
   - `status` is `LABEL_PURCHASED` or `SYNC_QUEUED`
   - `metadata.purchase.state` is `SUCCEEDED`
   - queue or sync state appears under `metadata.marketplaceSync`

## Verify BullMQ side effects
1. If the order belongs to an eBay account, inspect Redis or BullMQ UI for a `shipping-sync-ebay-fulfillment` job on `shipping-sync`.
2. Quick Redis check when using the default local queue:
   ```powershell
   redis-cli KEYS "bull:shipping-sync*"
   ```
3. After the worker runs, re-check the shipment row and confirm either:
   - `status = SYNCED_TO_MARKETPLACE`, or
   - `status = LABEL_PURCHASED` with `metadata.marketplaceSync.state = FAILED` or `QUEUE_FAILED`

## Validate eBay sync success and failure behavior
1. Success path:
   - use working eBay credentials and valid marketplace line item ids
   - confirm the shipment reaches `SYNCED_TO_MARKETPLACE`
   - confirm `metadata.marketplaceSync.state = SYNCED`
2. Failure path:
   - point `EBAY_API_BASE` to a failing sandbox/mock target or use intentionally invalid credentials
   - purchase a fresh label for a test order
   - confirm the shipment remains recoverable with:
     - `status = LABEL_PURCHASED`
     - `metadata.marketplaceSync.state = FAILED`
     - `metadata.lastError.stage = marketplace-sync`

## Validate duplicate purchase behavior
1. Re-submit the exact same purchase request for the same `orderId`, `providerShipmentId`, and `rateId`.
2. Confirm no second purchased shipment row is created:
   ```sql
   select provider_shipment_id, provider_rate_id, count(*)
   from "Shipment"
   where order_id = 'ORDER_ID'
   group by provider_shipment_id, provider_rate_id;
   ```
3. The count for the purchased shipment pair should remain `1`.

## Void the shipment
1. Replace `SHIPMENT_ID` with the purchased shipment id:
   ```powershell
   curl.exe -X POST http://localhost:3001/shipping/SHIPMENT_ID/void
   ```
2. Re-check the database row and confirm:
   - `status = VOIDED`
   - `voided_at` is populated
   - `metadata.void.state = SUCCEEDED`

## Validate the web workflow
1. Open [http://localhost:3000/orders](http://localhost:3000/orders).
2. Open the prepared order.
3. In the fulfillment panel:
   - enter parcel dimensions and weight
   - request rates
   - buy a label
   - confirm tracking number, label link, sync state, and shipment history update
   - void the shipment if needed

## Expected operator-visible failure behavior
- Quote failures return an API error immediately.
- Purchase failures persist a shipment row with `status = ERROR` and the latest failure in `metadata.lastError`.
- Queue or marketplace sync failures do not hide the label. The shipment remains operator-visible and recoverable from the order detail page.
- Void failures are surfaced immediately and also persisted into shipment metadata.
