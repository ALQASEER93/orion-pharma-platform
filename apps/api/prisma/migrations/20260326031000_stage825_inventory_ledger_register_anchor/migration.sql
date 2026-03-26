CREATE TABLE "inventory_ledger_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "posting_surface" TEXT NOT NULL DEFAULT 'BRANCH',
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT,
    "reference_line_id" TEXT,
    "reason_code" TEXT,
    "stock_bucket" TEXT NOT NULL DEFAULT 'SELLABLE',
    "quantity_delta" INTEGER NOT NULL,
    "unit_cost" REAL,
    "amount_total" REAL,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "inventory_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledger_entries_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledger_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledger_entries_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledger_entries_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledger_entries_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledger_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "inventory_lot_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT NOT NULL,
    "on_hand_quantity" INTEGER NOT NULL DEFAULT 0,
    "sellable_quantity" INTEGER NOT NULL DEFAULT 0,
    "quarantined_quantity" INTEGER NOT NULL DEFAULT 0,
    "expired_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_lot_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_lot_balances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_lot_balances_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_lot_balances_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "inventory_ledger_entries_tenant_id_branch_id_occurred_at_idx" ON "inventory_ledger_entries"("tenant_id", "branch_id", "occurred_at");
CREATE INDEX "inventory_ledger_entries_tenant_id_register_id_occurred_at_idx" ON "inventory_ledger_entries"("tenant_id", "register_id", "occurred_at");
CREATE INDEX "inventory_ledger_entries_tenant_id_product_pack_id_lot_batch_id_occurred_idx" ON "inventory_ledger_entries"("tenant_id", "product_pack_id", "lot_batch_id", "occurred_at");
CREATE INDEX "inventory_ledger_entries_tenant_id_reference_type_reference_id_idx" ON "inventory_ledger_entries"("tenant_id", "reference_type", "reference_id");

CREATE UNIQUE INDEX "inventory_lot_balances_tenant_id_branch_id_product_pack_id_lot_key" ON "inventory_lot_balances"("tenant_id", "branch_id", "product_pack_id", "lot_batch_id");
CREATE INDEX "inventory_lot_balances_tenant_id_branch_id_product_pack_id_idx" ON "inventory_lot_balances"("tenant_id", "branch_id", "product_pack_id");
CREATE INDEX "inventory_lot_balances_tenant_id_branch_id_on_hand_quantity_idx" ON "inventory_lot_balances"("tenant_id", "branch_id", "on_hand_quantity");
