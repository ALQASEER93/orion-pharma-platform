ALTER TABLE "sales_invoices"
ADD COLUMN "idempotency_key" TEXT;

ALTER TABLE "sales_invoices"
ADD COLUMN "payload_hash" TEXT;

CREATE UNIQUE INDEX "sales_invoices_tenant_id_idempotency_key_key"
ON "sales_invoices"("tenant_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
