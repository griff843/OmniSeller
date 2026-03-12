DO $$ BEGIN
  CREATE TYPE "ShipmentStatus" AS ENUM (
    'PENDING',
    'LABEL_PURCHASED',
    'SYNC_QUEUED',
    'SYNCED_TO_MARKETPLACE',
    'VOIDED',
    'ERROR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "buyerPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "buyerEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingName" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingCompany" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingAddress1" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingAddress2" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingCity" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingState" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingPostalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingCountry" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "marketplaceLineItemId" TEXT;

ALTER TABLE "Shipment"
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'easypost',
  ADD COLUMN IF NOT EXISTS "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "providerShipmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerRateId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerTrackerId" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingCode" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "labelFormat" TEXT,
  ADD COLUMN IF NOT EXISTS "rateAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "rateCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "parcelLength" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "parcelWidth" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "parcelHeight" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "parcelWeightOz" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "purchasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncedToMarketplaceAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);

UPDATE "Shipment"
SET "trackingCode" = COALESCE("trackingCode", "trackingNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_providerShipmentId_key"
  ON "Shipment"("providerShipmentId");

CREATE INDEX IF NOT EXISTS "OrderItem_marketplaceLineItemId_idx"
  ON "OrderItem"("marketplaceLineItemId");

CREATE INDEX IF NOT EXISTS "Shipment_status_idx"
  ON "Shipment"("status");

CREATE INDEX IF NOT EXISTS "Shipment_trackingCode_idx"
  ON "Shipment"("trackingCode");
