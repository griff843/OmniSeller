ALTER TABLE "User"
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "disabledReason" TEXT,
  ADD COLUMN "invitedAt" TIMESTAMP(3);

ALTER TABLE "MarketplaceAccount"
  ADD COLUMN "tokenKeyId" TEXT,
  ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "syncCursor" TEXT,
  ADD COLUMN "lastSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncError" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "providerCreatedAt" TIMESTAMP(3),
  ADD COLUMN "providerUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "rawDiagnostics" JSONB;

ALTER TABLE "Shipment" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "OrderItem_orderId_marketplaceLineItemId_key"
  ON "OrderItem"("orderId", "marketplaceLineItemId");
CREATE UNIQUE INDEX "Shipment_orderId_idempotencyKey_key"
  ON "Shipment"("orderId", "idempotencyKey");
