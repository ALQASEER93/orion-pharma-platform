-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_no" TEXT,
    "expiry_date" DATETIME,
    "movement_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" REAL,
    "cost_total" REAL,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "sales_invoice_line_id" TEXT,
    CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_sales_invoice_line_id_fkey" FOREIGN KEY ("sales_invoice_line_id") REFERENCES "sales_invoice_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inventory_movements" ("batch_no", "branch_id", "created_at", "created_by", "expiry_date", "id", "movement_type", "product_id", "quantity", "reason", "sales_invoice_line_id", "tenant_id")
SELECT "batch_no", "branch_id", "created_at", "created_by", "expiry_date", "id", "movement_type", "product_id", "quantity", "reason", "sales_invoice_line_id", "tenant_id" FROM "inventory_movements";
DROP TABLE "inventory_movements";
ALTER TABLE "new_inventory_movements" RENAME TO "inventory_movements";
CREATE INDEX "inventory_movements_tenant_id_branch_id_product_id_batch_no_idx" ON "inventory_movements"("tenant_id", "branch_id", "product_id", "batch_no");
CREATE INDEX "inventory_movements_tenant_id_sales_invoice_line_id_idx" ON "inventory_movements"("tenant_id", "sales_invoice_line_id");
CREATE UNIQUE INDEX "inventory_movements_sales_invoice_line_id_batch_no_key" ON "inventory_movements"("sales_invoice_line_id", "batch_no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "inventory_valuation_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_on_hand" REAL NOT NULL DEFAULT 0,
    "avg_unit_cost" REAL NOT NULL DEFAULT 0,
    "inventory_value" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_valuation_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_valuation_states_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_valuation_states_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_valuation_applied" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inventory_movement_id" TEXT NOT NULL,
    "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_valuation_applied_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_valuation_applied_inventory_movement_id_fkey" FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cogs_posting_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "posted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cogs_posting_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cogs_posting_links_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cogs_posting_links_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuation_states_tenant_id_branch_id_product_id_key" ON "inventory_valuation_states"("tenant_id", "branch_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_valuation_states_tenant_id_branch_id_idx" ON "inventory_valuation_states"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuation_applied_tenant_id_inventory_movement_id_key" ON "inventory_valuation_applied"("tenant_id", "inventory_movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuation_applied_inventory_movement_id_key" ON "inventory_valuation_applied"("inventory_movement_id");

-- CreateIndex
CREATE INDEX "inventory_valuation_applied_tenant_id_applied_at_idx" ON "inventory_valuation_applied"("tenant_id", "applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "cogs_posting_links_tenant_id_sales_invoice_id_key" ON "cogs_posting_links"("tenant_id", "sales_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "cogs_posting_links_sales_invoice_id_key" ON "cogs_posting_links"("sales_invoice_id");

-- CreateIndex
CREATE INDEX "cogs_posting_links_tenant_id_posted_at_idx" ON "cogs_posting_links"("tenant_id", "posted_at");
