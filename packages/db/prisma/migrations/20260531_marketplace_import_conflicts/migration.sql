CREATE TYPE "MarketplaceImportConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

CREATE TABLE "MarketplaceImportConflict" (
    "id" TEXT NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "resource" "MarketplaceSyncResource" NOT NULL,
    "entityType" TEXT NOT NULL,
    "remoteEntityId" TEXT NOT NULL,
    "localEntityId" TEXT,
    "status" "MarketplaceImportConflictStatus" NOT NULL DEFAULT 'OPEN',
    "fieldDiffs" JSONB NOT NULL,
    "localSnapshot" JSONB NOT NULL,
    "remoteSnapshot" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceImportConflict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceImportConflict_marketplaceAccountId_resource_entityType_remoteEntityId_key" ON "MarketplaceImportConflict"("marketplaceAccountId", "resource", "entityType", "remoteEntityId");

CREATE INDEX "MarketplaceImportConflict_marketplaceAccountId_status_idx" ON "MarketplaceImportConflict"("marketplaceAccountId", "status");

CREATE INDEX "MarketplaceImportConflict_resource_status_idx" ON "MarketplaceImportConflict"("resource", "status");

ALTER TABLE "MarketplaceImportConflict" ADD CONSTRAINT "MarketplaceImportConflict_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
