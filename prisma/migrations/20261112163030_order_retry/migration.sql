-- DropIndex
DROP INDEX "PurchaseOrder_purchaseRequestId_key";

-- CreateIndex
CREATE INDEX "PurchaseOrder_purchaseRequestId_idx" ON "PurchaseOrder"("purchaseRequestId");
