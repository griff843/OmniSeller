# Shipping Domain V1

## Purpose
Shipping owns parcel rating, label purchase, shipment persistence, marketplace fulfillment sync dispatch, and refund/void state for fulfilled orders. The database shipment record is the source of truth for operator UI, queue jobs, and post-purchase support workflows.

## Domain responsibilities
- Resolve shipment context from an order and the submitted parcel data.
- Request live carrier rates through the provider client.
- Purchase a label exactly once per provider shipment and selected rate combination.
- Persist shipment facts such as provider ids, tracking, label URL, parcel dimensions, pricing, and operational metadata.
- Enqueue marketplace sync work after label purchase when the order belongs to an eBay marketplace account.
- Persist recoverable failures so operators can understand what happened without reading worker logs.
- Void a purchased label and mark the shipment record accordingly.

## Shipment lifecycle
- `PENDING`: A shipment row exists for an in-flight purchase attempt.
- `LABEL_PURCHASED`: A label exists and the order can still be recovered manually if sync or queue work fails.
- `SYNC_QUEUED`: Label purchase succeeded and the shipment was pushed onto the BullMQ fulfillment sync queue.
- `SYNCED_TO_MARKETPLACE`: eBay accepted the fulfillment tracking payload.
- `VOIDED`: The provider refund/void request succeeded.
- `ERROR`: Label purchase failed before a usable shipment could be produced.

## Status model notes
- Purchase failures move the row to `ERROR` and record `metadata.purchase` plus `metadata.lastError` with a recoverable flag.
- Queue enqueue failures degrade the shipment back to `LABEL_PURCHASED` instead of leaving it in a fake queued state.
- eBay sync failures also degrade to `LABEL_PURCHASED` and store sync failure details in `metadata.marketplaceSync` plus `metadata.lastError`.
- Void failures keep the existing shipment status and attach failure details under `metadata.void`.

## Provider boundary
- `EasyPostClient` is the only shipping-provider integration boundary in v1.
- The provider client is responsible for:
  - creating provider shipment quotes
  - buying a shipment for a selected rate
  - refunding/voiding a purchased shipment
- Generic shipping services should never contain eBay-specific provider behavior.

## Marketplace sync boundary
- Marketplace sync is outside the generic label-purchase path.
- `ShippingService` decides whether a newly purchased shipment requires marketplace sync by inspecting the order's marketplace account kind.
- eBay fulfillment sync is isolated in `EbayFulfillmentSyncService` and only receives a shipment id from BullMQ.
- Generic UI components display sync state from shipment metadata and do not contain eBay API details.

## Idempotency rules
- Rate quotes are stateless and do not create database rows.
- Label purchase reuses an existing shipment when the same `orderId + providerShipmentId + providerRateId` already exists in a purchased or synced state.
- Before calling the provider buy operation, the API creates or resets a `PENDING` shipment row keyed by the provider shipment id and rate id.
- That pending row is promoted to the final shipment state after provider purchase succeeds.
- Because the shipment row exists before completion, purchase and queue failures can be persisted and inspected later.

## Queue flow
1. Operator requests rates through `POST /shipping/rates`.
2. Operator chooses a rate and purchases the label through `POST /shipping/purchase`.
3. The purchased shipment is written to the database.
4. If the order belongs to an eBay account, the API enqueues `shipping-sync-ebay-fulfillment` on the `shipping-sync` BullMQ queue.
5. `ShippingProcessor` consumes the job and calls `EbayFulfillmentSyncService.syncTrackingForShipment`.
6. The service updates the shipment to `SYNCED_TO_MARKETPLACE` on success or writes a recoverable sync failure back to the shipment row.

## Failure and retry behavior
- Provider quote failures bubble to the caller and do not create shipment rows.
- Provider purchase failures create a durable `ERROR` shipment record with purchase failure metadata.
- Queue enqueue failures do not silently disappear. The shipment remains usable as `LABEL_PURCHASED` and stores the queue failure in metadata.
- BullMQ retries marketplace sync automatically using exponential backoff. If eBay still fails, the shipment remains purchased and exposes the latest sync error in metadata for operator follow-up.
- Void/refund failures are written back to shipment metadata and re-thrown so the caller sees the failure immediately.

## Source of truth
- `Shipment` rows are the operational source of truth.
- `metadata.marketplaceSync` stores queue and marketplace sync state transitions.
- `metadata.lastError` stores the latest operator-visible failure for support workflows.
- Support and UI should trust persisted shipment state over ephemeral queue logs.
