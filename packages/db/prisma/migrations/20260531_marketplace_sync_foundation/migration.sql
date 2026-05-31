CREATE TYPE "MarketplaceSyncResource" AS ENUM ('LISTINGS', 'ORDERS');

CREATE TYPE "MarketplaceSyncStatus" AS ENUM ('IDLE', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "MarketplaceSyncState" (
    "id" TEXT NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "resource" "MarketplaceSyncResource" NOT NULL,
    "status" "MarketplaceSyncStatus" NOT NULL DEFAULT 'IDLE',
    "cursor" TEXT,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceSyncState_marketplaceAccountId_resource_key" ON "MarketplaceSyncState"("marketplaceAccountId", "resource");

CREATE INDEX "MarketplaceSyncState_resource_status_idx" ON "MarketplaceSyncState"("resource", "status");

CREATE UNIQUE INDEX "Listing_marketplaceAccountId_marketplaceItemId_key" ON "Listing"("marketplaceAccountId", "marketplaceItemId");

CREATE UNIQUE INDEX "OrderItem_orderId_marketplaceLineItemId_key" ON "OrderItem"("orderId", "marketplaceLineItemId");

ALTER TABLE "MarketplaceSyncState" ADD CONSTRAINT "MarketplaceSyncState_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
