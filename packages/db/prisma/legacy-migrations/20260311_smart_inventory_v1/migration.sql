CREATE TYPE "InventoryStatus" AS ENUM ('DRAFT', 'IN_STOCK', 'HOLD', 'ARCHIVED');
CREATE TYPE "ListingReadiness" AS ENUM ('NEEDS_INTAKE', 'NEEDS_PHOTOS', 'READY_FOR_AI', 'READY_FOR_LISTING', 'READY_TO_PUBLISH', 'LISTED');
CREATE TYPE "SaleLifecycleStatus" AS ENUM ('AVAILABLE', 'LISTED', 'RESERVED', 'SOLD', 'SHIPPED');

ALTER TABLE "Bin"
  ADD COLUMN "label" TEXT,
  ADD COLUMN "area" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Bin" DROP CONSTRAINT IF EXISTS "Bin_code_key";
CREATE UNIQUE INDEX "Bin_userId_code_key" ON "Bin"("userId", "code");
CREATE INDEX "Bin_userId_area_idx" ON "Bin"("userId", "area");
CREATE INDEX "Bin_userId_isActive_idx" ON "Bin"("userId", "isActive");

ALTER TABLE "InventoryItem"
  ADD COLUMN "skuManuallySet" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scanCode" TEXT,
  ADD COLUMN "inventoryStatus" "InventoryStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "listingReadiness" "ListingReadiness" NOT NULL DEFAULT 'NEEDS_INTAKE',
  ADD COLUMN "saleStatus" "SaleLifecycleStatus" NOT NULL DEFAULT 'AVAILABLE';

UPDATE "InventoryItem"
SET "inventoryStatus" = CASE
  WHEN lower(coalesce("status", 'draft')) = 'archived' THEN 'ARCHIVED'::"InventoryStatus"
  WHEN "binId" IS NOT NULL THEN 'IN_STOCK'::"InventoryStatus"
  ELSE 'DRAFT'::"InventoryStatus"
END;

UPDATE "InventoryItem"
SET "saleStatus" = 'LISTED'::"SaleLifecycleStatus"
WHERE EXISTS (
  SELECT 1
  FROM "Listing"
  WHERE "Listing"."inventoryItemId" = "InventoryItem"."id"
);

UPDATE "InventoryItem"
SET "listingReadiness" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "Listing"
    WHERE "Listing"."inventoryItemId" = "InventoryItem"."id"
  ) THEN 'LISTED'::"ListingReadiness"
  WHEN EXISTS (
    SELECT 1 FROM "ListingDraft"
    WHERE "ListingDraft"."inventoryItemId" = "InventoryItem"."id"
      AND coalesce("ListingDraft"."title", '') <> ''
      AND coalesce("ListingDraft"."description", '') <> ''
      AND coalesce("ListingDraft"."category", '') <> ''
      AND "ListingDraft"."priceCents" IS NOT NULL
  ) THEN 'READY_TO_PUBLISH'::"ListingReadiness"
  WHEN EXISTS (
    SELECT 1 FROM "AiListingSuggestion"
    WHERE "AiListingSuggestion"."inventoryItemId" = "InventoryItem"."id"
  ) OR EXISTS (
    SELECT 1 FROM "ListingDraft"
    WHERE "ListingDraft"."inventoryItemId" = "InventoryItem"."id"
  ) THEN 'READY_FOR_LISTING'::"ListingReadiness"
  WHEN coalesce("InventoryItem"."title", '') <> ''
    AND coalesce("InventoryItem"."condition", '') <> ''
    AND EXISTS (
      SELECT 1 FROM "Photo"
      WHERE "Photo"."inventoryItemId" = "InventoryItem"."id"
        AND "Photo"."deletedAt" IS NULL
        AND "Photo"."uploadStatus" = 'READY'
        AND "Photo"."url" IS NOT NULL
    ) THEN 'READY_FOR_AI'::"ListingReadiness"
  WHEN coalesce("InventoryItem"."title", '') <> ''
    AND coalesce("InventoryItem"."condition", '') <> '' THEN 'NEEDS_PHOTOS'::"ListingReadiness"
  ELSE 'NEEDS_INTAKE'::"ListingReadiness"
END;

ALTER TABLE "InventoryItem" DROP COLUMN IF EXISTS "status";

CREATE INDEX "InventoryItem_inventoryStatus_idx" ON "InventoryItem"("inventoryStatus");
CREATE INDEX "InventoryItem_listingReadiness_idx" ON "InventoryItem"("listingReadiness");
CREATE INDEX "InventoryItem_saleStatus_idx" ON "InventoryItem"("saleStatus");
CREATE INDEX "InventoryItem_binId_idx" ON "InventoryItem"("binId");
CREATE INDEX "InventoryItem_upc_idx" ON "InventoryItem"("upc");
CREATE INDEX "InventoryItem_scanCode_idx" ON "InventoryItem"("scanCode");
