-- DropIndex
DROP INDEX "PaymentRequest_purchaseOrderId_key";

-- CreateIndex
CREATE INDEX "PaymentRequest_purchaseOrderId_idx" ON "PaymentRequest"("purchaseOrderId");
