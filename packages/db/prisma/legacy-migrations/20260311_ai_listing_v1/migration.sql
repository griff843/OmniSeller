DO $$ BEGIN
  CREATE TYPE "AiListingSuggestionStatus" AS ENUM (
    'GENERATED',
    'APPLIED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "itemSpecifics" JSONB;

CREATE TABLE IF NOT EXISTS "ListingDraft" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "marketplace" TEXT NOT NULL DEFAULT 'ebay',
  "title" TEXT,
  "description" TEXT,
  "category" TEXT,
  "priceCents" INTEGER,
  "itemSpecifics" JSONB,
  "sourceSuggestionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ListingDraft_inventoryItemId_key"
  ON "ListingDraft"("inventoryItemId");

CREATE TABLE IF NOT EXISTS "AiListingSuggestion" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "status" "AiListingSuggestionStatus" NOT NULL DEFAULT 'GENERATED',
  "title" TEXT,
  "description" TEXT,
  "suggestedCategory" TEXT,
  "suggestedPriceCents" INTEGER,
  "itemSpecifics" JSONB,
  "sourceSnapshot" JSONB NOT NULL,
  "rawResponse" JSONB,
  "errorMessage" TEXT,
  "generatedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiListingSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiListingSuggestion_inventoryItemId_createdAt_idx"
  ON "AiListingSuggestion"("inventoryItemId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiListingSuggestion_status_idx"
  ON "AiListingSuggestion"("status");

DO $$ BEGIN
  ALTER TABLE "ListingDraft"
    ADD CONSTRAINT "ListingDraft_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiListingSuggestion"
    ADD CONSTRAINT "AiListingSuggestion_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
