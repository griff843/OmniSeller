CREATE TYPE "PublishExecutionStatus" AS ENUM (
  'NOT_REQUESTED',
  'BLOCKED',
  'QUEUED',
  'PROCESSING',
  'UNAVAILABLE',
  'FAILED',
  'PUBLISHED'
);

ALTER TABLE "InventoryItem"
ADD COLUMN "publishStatus" "PublishExecutionStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "publishMarketplace" TEXT,
ADD COLUMN "publishRequestedAt" TIMESTAMP(3),
ADD COLUMN "publishQueuedAt" TIMESTAMP(3),
ADD COLUMN "publishStartedAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishFailedAt" TIMESTAMP(3),
ADD COLUMN "publishError" TEXT;

CREATE INDEX "InventoryItem_publishStatus_idx" ON "InventoryItem"("publishStatus");
