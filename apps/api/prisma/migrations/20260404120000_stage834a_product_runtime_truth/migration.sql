ALTER TABLE "products" ADD COLUMN "supplier_id" TEXT;
ALTER TABLE "products" ADD COLUMN "default_sale_price" REAL;

CREATE INDEX "products_tenant_id_supplier_id_idx"
ON "products"("tenant_id", "supplier_id");
