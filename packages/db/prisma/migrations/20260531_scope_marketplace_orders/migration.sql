DROP INDEX IF EXISTS "Order_marketplaceOrderId_key";

CREATE UNIQUE INDEX "Order_marketplaceAccountId_marketplaceOrderId_key" ON "Order"("marketplaceAccountId", "marketplaceOrderId");
