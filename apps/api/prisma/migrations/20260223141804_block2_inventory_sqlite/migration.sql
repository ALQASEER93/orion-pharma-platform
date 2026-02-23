-- CreateTable
CREATE TABLE "therapeutic_classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "therapeutic_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dosage_forms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dosage_forms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "storage_conditions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "storage_conditions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "regulatory_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "regulatory_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "therapeutic_class_id" TEXT,
    "dosage_form_id" TEXT,
    "storage_condition_id" TEXT,
    "regulatory_type_id" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "pack_size" TEXT NOT NULL,
    "tracking_mode" TEXT NOT NULL DEFAULT 'NONE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "products_therapeutic_class_id_fkey" FOREIGN KEY ("therapeutic_class_id") REFERENCES "therapeutic_classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_dosage_form_id_fkey" FOREIGN KEY ("dosage_form_id") REFERENCES "dosage_forms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_storage_condition_id_fkey" FOREIGN KEY ("storage_condition_id") REFERENCES "storage_conditions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_regulatory_type_id_fkey" FOREIGN KEY ("regulatory_type_id") REFERENCES "regulatory_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_no" TEXT,
    "expiry_date" DATETIME,
    "movement_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "therapeutic_classes_tenant_id_name_en_key" ON "therapeutic_classes"("tenant_id", "name_en");

-- CreateIndex
CREATE UNIQUE INDEX "dosage_forms_tenant_id_name_en_key" ON "dosage_forms"("tenant_id", "name_en");

-- CreateIndex
CREATE UNIQUE INDEX "storage_conditions_tenant_id_name_en_key" ON "storage_conditions"("tenant_id", "name_en");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_types_tenant_id_name_en_key" ON "regulatory_types"("tenant_id", "name_en");

-- CreateIndex
CREATE INDEX "products_tenant_id_name_en_idx" ON "products"("tenant_id", "name_en");

-- CreateIndex
CREATE INDEX "products_tenant_id_name_ar_idx" ON "products"("tenant_id", "name_ar");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_barcode_key" ON "products"("tenant_id", "barcode");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_branch_id_product_id_batch_no_idx" ON "inventory_movements"("tenant_id", "branch_id", "product_id", "batch_no");
