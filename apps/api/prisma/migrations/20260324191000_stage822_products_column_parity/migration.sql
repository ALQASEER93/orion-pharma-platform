ALTER TABLE "products" ADD COLUMN "trade_name_ar" TEXT;
ALTER TABLE "products" ADD COLUMN "trade_name_en" TEXT;
ALTER TABLE "products" ADD COLUMN "generic_name_ar" TEXT;
ALTER TABLE "products" ADD COLUMN "generic_name_en" TEXT;
ALTER TABLE "products" ADD COLUMN "category_ar" TEXT;
ALTER TABLE "products" ADD COLUMN "category_en" TEXT;
ALTER TABLE "products" ADD COLUMN "unit_of_measure" TEXT;
ALTER TABLE "products" ADD COLUMN "tax_profile_code" TEXT;
ALTER TABLE "products" ADD COLUMN "medication_access_mode" TEXT NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE "products" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "products_tenant_id_trade_name_en_idx"
ON "products"("tenant_id", "trade_name_en");

CREATE INDEX "products_tenant_id_generic_name_en_idx"
ON "products"("tenant_id", "generic_name_en");

CREATE INDEX "products_tenant_id_is_active_name_en_idx"
ON "products"("tenant_id", "is_active", "name_en");
