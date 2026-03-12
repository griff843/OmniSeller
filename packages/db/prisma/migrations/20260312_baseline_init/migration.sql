-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('DRAFT', 'IN_STOCK', 'HOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ListingReadiness" AS ENUM ('NEEDS_INTAKE', 'NEEDS_PHOTOS', 'READY_FOR_AI', 'READY_FOR_LISTING', 'READY_TO_PUBLISH', 'LISTED');

-- CreateEnum
CREATE TYPE "SaleLifecycleStatus" AS ENUM ('AVAILABLE', 'LISTED', 'RESERVED', 'SOLD', 'SHIPPED');

-- CreateEnum
CREATE TYPE "PhotoUploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'READY', 'PROCESSING', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "PhotoAssetRole" AS ENUM ('ORIGINAL', 'PROCESSED', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "AiListingSuggestionStatus" AS ENUM ('GENERATED', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'LABEL_PURCHASED', 'SYNC_QUEUED', 'SYNCED_TO_MARKETPLACE', 'VOIDED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "MarketplaceAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "siteId" TEXT,
    "nickname" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "area" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "skuManuallySet" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "condition" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "upc" TEXT,
    "scanCode" TEXT,
    "costBasisCents" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "dimsCm" JSONB,
    "binId" TEXT,
    "inventoryStatus" "InventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "listingReadiness" "ListingReadiness" NOT NULL DEFAULT 'NEEDS_INTAKE',
    "saleStatus" "SaleLifecycleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "url" TEXT,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "role" "PhotoAssetRole" NOT NULL DEFAULT 'ORIGINAL',
    "uploadStatus" "PhotoUploadStatus" NOT NULL DEFAULT 'PENDING',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "metadata" JSONB,
    "uploadedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingDraft" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiListingSuggestion" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiListingSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "marketplaceItemId" TEXT,
    "offerId" TEXT,
    "listingUrl" TEXT,
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "itemSpecifics" JSONB,
    "priceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "shippingProfile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "marketplaceOrderId" TEXT NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "buyerName" TEXT,
    "buyerAddress" JSONB,
    "buyerPhone" TEXT,
    "buyerEmail" TEXT,
    "shippingName" TEXT,
    "shippingCompany" TEXT,
    "shippingAddress1" TEXT,
    "shippingAddress2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "totalCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "listingId" TEXT,
    "inventoryItemId" TEXT,
    "marketplaceLineItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "salePriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "providerShipmentId" TEXT,
    "providerRateId" TEXT,
    "providerTrackerId" TEXT,
    "carrier" TEXT,
    "service" TEXT,
    "trackingCode" TEXT,
    "trackingStatus" TEXT,
    "labelUrl" TEXT,
    "labelFormat" TEXT,
    "rateAmount" DECIMAL(10,2),
    "rateCurrency" TEXT,
    "parcelLength" DECIMAL(10,2),
    "parcelWidth" DECIMAL(10,2),
    "parcelHeight" DECIMAL(10,2),
    "parcelWeightOz" DECIMAL(10,2),
    "metadata" JSONB,
    "purchasedAt" TIMESTAMP(3),
    "syncedToMarketplaceAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "listingId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "MarketplaceAccount_userId_idx" ON "MarketplaceAccount"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceAccount_kind_idx" ON "MarketplaceAccount"("kind");

-- CreateIndex
CREATE INDEX "Bin_userId_idx" ON "Bin"("userId");

-- CreateIndex
CREATE INDEX "Bin_userId_area_idx" ON "Bin"("userId", "area");

-- CreateIndex
CREATE INDEX "Bin_userId_isActive_idx" ON "Bin"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Bin_userId_code_key" ON "Bin"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_idx" ON "InventoryItem"("userId");

-- CreateIndex
CREATE INDEX "InventoryItem_inventoryStatus_idx" ON "InventoryItem"("inventoryStatus");

-- CreateIndex
CREATE INDEX "InventoryItem_listingReadiness_idx" ON "InventoryItem"("listingReadiness");

-- CreateIndex
CREATE INDEX "InventoryItem_saleStatus_idx" ON "InventoryItem"("saleStatus");

-- CreateIndex
CREATE INDEX "InventoryItem_brand_idx" ON "InventoryItem"("brand");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_binId_idx" ON "InventoryItem"("binId");

-- CreateIndex
CREATE INDEX "InventoryItem_upc_idx" ON "InventoryItem"("upc");

-- CreateIndex
CREATE INDEX "InventoryItem_scanCode_idx" ON "InventoryItem"("scanCode");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_storageKey_key" ON "Photo"("storageKey");

-- CreateIndex
CREATE INDEX "Photo_inventoryItemId_idx" ON "Photo"("inventoryItemId");

-- CreateIndex
CREATE INDEX "Photo_inventoryItemId_deletedAt_idx" ON "Photo"("inventoryItemId", "deletedAt");

-- CreateIndex
CREATE INDEX "Photo_inventoryItemId_sort_idx" ON "Photo"("inventoryItemId", "sort");

-- CreateIndex
CREATE INDEX "Photo_inventoryItemId_isPrimary_idx" ON "Photo"("inventoryItemId", "isPrimary");

-- CreateIndex
CREATE INDEX "Photo_uploadStatus_idx" ON "Photo"("uploadStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ListingDraft_inventoryItemId_key" ON "ListingDraft"("inventoryItemId");

-- CreateIndex
CREATE INDEX "AiListingSuggestion_inventoryItemId_createdAt_idx" ON "AiListingSuggestion"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "AiListingSuggestion_status_idx" ON "AiListingSuggestion"("status");

-- CreateIndex
CREATE INDEX "Listing_inventoryItemId_idx" ON "Listing"("inventoryItemId");

-- CreateIndex
CREATE INDEX "Listing_marketplaceAccountId_idx" ON "Listing"("marketplaceAccountId");

-- CreateIndex
CREATE INDEX "Listing_marketplace_status_idx" ON "Listing"("marketplace", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_marketplaceOrderId_key" ON "Order"("marketplaceOrderId");

-- CreateIndex
CREATE INDEX "Order_marketplaceAccountId_idx" ON "Order"("marketplaceAccountId");

-- CreateIndex
CREATE INDEX "Order_marketplace_createdAt_idx" ON "Order"("marketplace", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_listingId_idx" ON "OrderItem"("listingId");

-- CreateIndex
CREATE INDEX "OrderItem_inventoryItemId_idx" ON "OrderItem"("inventoryItemId");

-- CreateIndex
CREATE INDEX "OrderItem_marketplaceLineItemId_idx" ON "OrderItem"("marketplaceLineItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_providerShipmentId_key" ON "Shipment"("providerShipmentId");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_trackingCode_idx" ON "Shipment"("trackingCode");

-- CreateIndex
CREATE INDEX "PriceHistory_inventoryItemId_idx" ON "PriceHistory"("inventoryItemId");

-- CreateIndex
CREATE INDEX "PriceHistory_listingId_idx" ON "PriceHistory"("listingId");

-- CreateIndex
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAccount" ADD CONSTRAINT "MarketplaceAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bin" ADD CONSTRAINT "Bin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingDraft" ADD CONSTRAINT "ListingDraft_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiListingSuggestion" ADD CONSTRAINT "AiListingSuggestion_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

