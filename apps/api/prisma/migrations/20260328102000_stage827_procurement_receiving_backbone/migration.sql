CREATE TABLE "supplier_stock_receipts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by" TEXT,
    CONSTRAINT "supplier_stock_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipts_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "supplier_stock_receipt_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receipt_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL DEFAULT 1,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT NOT NULL,
    "quantity_received" INTEGER NOT NULL,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" REAL,
    "line_total" REAL,
    "inventory_ledger_entry_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_stock_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "supplier_stock_receipts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipt_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipt_lines_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipt_lines_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_receipt_lines_inventory_ledger_entry_id_fkey" FOREIGN KEY ("inventory_ledger_entry_id") REFERENCES "inventory_ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "supplier_stock_returns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "source_receipt_id" TEXT,
    "return_number" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "reason_code" TEXT,
    "notes" TEXT,
    "returned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by" TEXT,
    CONSTRAINT "supplier_stock_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_returns_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_returns_source_receipt_id_fkey" FOREIGN KEY ("source_receipt_id") REFERENCES "supplier_stock_receipts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "supplier_stock_return_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "return_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_receipt_line_id" TEXT,
    "line_no" INTEGER NOT NULL DEFAULT 1,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT NOT NULL,
    "quantity_returned" INTEGER NOT NULL,
    "reason_code" TEXT,
    "inventory_ledger_entry_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_stock_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "supplier_stock_returns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_return_lines_source_receipt_line_id_fkey" FOREIGN KEY ("source_receipt_line_id") REFERENCES "supplier_stock_receipt_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_return_lines_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_return_lines_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supplier_stock_return_lines_inventory_ledger_entry_id_fkey" FOREIGN KEY ("inventory_ledger_entry_id") REFERENCES "inventory_ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "supplier_stock_receipts_tenant_id_receipt_number_key" ON "supplier_stock_receipts"("tenant_id", "receipt_number");
CREATE INDEX "supplier_stock_receipts_tenant_id_branch_id_received_at_idx" ON "supplier_stock_receipts"("tenant_id", "branch_id", "received_at");
CREATE INDEX "supplier_stock_receipts_tenant_id_supplier_id_state_received_at_idx" ON "supplier_stock_receipts"("tenant_id", "supplier_id", "state", "received_at");

CREATE UNIQUE INDEX "supplier_stock_receipt_lines_receipt_id_line_no_key" ON "supplier_stock_receipt_lines"("receipt_id", "line_no");
CREATE UNIQUE INDEX "supplier_stock_receipt_lines_inventory_ledger_entry_id_key" ON "supplier_stock_receipt_lines"("inventory_ledger_entry_id");
CREATE INDEX "supplier_stock_receipt_lines_tenant_id_receipt_id_idx" ON "supplier_stock_receipt_lines"("tenant_id", "receipt_id");
CREATE INDEX "supplier_stock_receipt_lines_tenant_id_product_pack_id_lot_batch_id_idx" ON "supplier_stock_receipt_lines"("tenant_id", "product_pack_id", "lot_batch_id");

CREATE UNIQUE INDEX "supplier_stock_returns_tenant_id_return_number_key" ON "supplier_stock_returns"("tenant_id", "return_number");
CREATE INDEX "supplier_stock_returns_tenant_id_source_receipt_id_idx" ON "supplier_stock_returns"("tenant_id", "source_receipt_id");
CREATE INDEX "supplier_stock_returns_tenant_id_supplier_id_state_returned_at_idx" ON "supplier_stock_returns"("tenant_id", "supplier_id", "state", "returned_at");

CREATE UNIQUE INDEX "supplier_stock_return_lines_return_id_line_no_key" ON "supplier_stock_return_lines"("return_id", "line_no");
CREATE UNIQUE INDEX "supplier_stock_return_lines_inventory_ledger_entry_id_key" ON "supplier_stock_return_lines"("inventory_ledger_entry_id");
CREATE INDEX "supplier_stock_return_lines_tenant_id_return_id_idx" ON "supplier_stock_return_lines"("tenant_id", "return_id");
CREATE INDEX "supplier_stock_return_lines_tenant_id_source_receipt_line_id_idx" ON "supplier_stock_return_lines"("tenant_id", "source_receipt_line_id");
CREATE INDEX "supplier_stock_return_lines_tenant_id_product_pack_id_lot_batch_id_idx" ON "supplier_stock_return_lines"("tenant_id", "product_pack_id", "lot_batch_id");
