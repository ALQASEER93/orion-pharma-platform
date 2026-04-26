ALTER TABLE "branches" ADD COLUMN "legal_entity_id" TEXT;

CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "registration_number" TEXT,
    "tax_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "legal_entities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "registers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "registers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "registers_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "registers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "product_packs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "units_per_pack" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sellability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "product_packs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_packs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "lot_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "product_pack_id" TEXT NOT NULL,
    "batch_no" TEXT NOT NULL,
    "expiry_date" DATETIME,
    "received_on" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "is_sellable" BOOLEAN NOT NULL DEFAULT true,
    "quarantined_at" DATETIME,
    "quarantine_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "lot_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lot_batches_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "legal_entities_tenant_id_code_key" ON "legal_entities"("tenant_id", "code");
CREATE INDEX "legal_entities_tenant_id_is_active_name_en_idx" ON "legal_entities"("tenant_id", "is_active", "name_en");
CREATE INDEX "branches_tenant_id_legal_entity_id_idx" ON "branches"("tenant_id", "legal_entity_id");

CREATE UNIQUE INDEX "registers_tenant_id_branch_id_code_key" ON "registers"("tenant_id", "branch_id", "code");
CREATE INDEX "registers_tenant_id_legal_entity_id_is_active_idx" ON "registers"("tenant_id", "legal_entity_id", "is_active");
CREATE INDEX "registers_tenant_id_branch_id_is_active_idx" ON "registers"("tenant_id", "branch_id", "is_active");

CREATE UNIQUE INDEX "product_packs_tenant_id_code_key" ON "product_packs"("tenant_id", "code");
CREATE INDEX "product_packs_tenant_id_product_id_status_idx" ON "product_packs"("tenant_id", "product_id", "status");
CREATE INDEX "product_packs_tenant_id_product_id_sellability_idx" ON "product_packs"("tenant_id", "product_id", "sellability");

CREATE UNIQUE INDEX "lot_batches_tenant_id_product_pack_id_batch_no_key" ON "lot_batches"("tenant_id", "product_pack_id", "batch_no");
CREATE INDEX "lot_batches_tenant_id_status_expiry_date_idx" ON "lot_batches"("tenant_id", "status", "expiry_date");
CREATE INDEX "lot_batches_tenant_id_is_sellable_expiry_date_idx" ON "lot_batches"("tenant_id", "is_sellable", "expiry_date");
