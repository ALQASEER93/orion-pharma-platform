CREATE TABLE "product_workspace_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL DEFAULT '',
    "name_en" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT NOT NULL DEFAULT '',
    "strength" TEXT NOT NULL DEFAULT '',
    "pack_size" TEXT NOT NULL DEFAULT '',
    "tracking_mode" TEXT NOT NULL DEFAULT 'NONE',
    "catalog_product_id" TEXT,
    "based_on_product_id" TEXT,
    "last_promoted_at" DATETIME,
    "last_activated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "product_workspace_drafts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_workspace_drafts_catalog_product_id_fkey" FOREIGN KEY ("catalog_product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "product_workspace_drafts_based_on_product_id_fkey" FOREIGN KEY ("based_on_product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "product_workspace_record_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "record_kind" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "queued" BOOLEAN NOT NULL DEFAULT false,
    "prioritized" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "product_workspace_record_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "product_workspace_worklists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "filter" TEXT NOT NULL DEFAULT 'ALL',
    "selected_keys" JSONB NOT NULL,
    "focused_key" TEXT NOT NULL DEFAULT '',
    "scope_summary" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "product_workspace_worklists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "product_workspace_drafts_tenant_id_key"
ON "product_workspace_drafts"("tenant_id");

CREATE INDEX "product_workspace_drafts_tenant_id_updated_at_idx"
ON "product_workspace_drafts"("tenant_id", "updated_at");

CREATE INDEX "product_workspace_drafts_tenant_id_catalog_product_id_idx"
ON "product_workspace_drafts"("tenant_id", "catalog_product_id");

CREATE INDEX "product_workspace_drafts_tenant_id_based_on_product_id_idx"
ON "product_workspace_drafts"("tenant_id", "based_on_product_id");

CREATE UNIQUE INDEX "product_workspace_record_states_tenant_id_record_kind_record_id_key"
ON "product_workspace_record_states"("tenant_id", "record_kind", "record_id");

CREATE INDEX "product_workspace_record_states_tenant_id_updated_at_idx"
ON "product_workspace_record_states"("tenant_id", "updated_at");

CREATE INDEX "product_workspace_worklists_tenant_id_updated_at_idx"
ON "product_workspace_worklists"("tenant_id", "updated_at");
