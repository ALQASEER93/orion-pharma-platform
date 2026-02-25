-- AlterTable
ALTER TABLE "sales_invoice_lines" ADD COLUMN "cost_method_snapshot" TEXT;
ALTER TABLE "sales_invoice_lines" ADD COLUMN "unit_cost_snapshot" REAL;

-- RedefineTables
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
INSERT INTO "new_inventory_movements" ("batch_no", "branch_id", "created_at", "created_by", "expiry_date", "id", "movement_type", "product_id", "quantity", "reason", "tenant_id") SELECT "batch_no", "branch_id", "created_at", "created_by", "expiry_date", "id", "movement_type", "product_id", "quantity", "reason", "tenant_id" FROM "inventory_movements";
DROP TABLE "inventory_movements";
ALTER TABLE "new_inventory_movements" RENAME TO "inventory_movements";
CREATE INDEX "inventory_movements_tenant_id_branch_id_product_id_batch_no_idx" ON "inventory_movements"("tenant_id", "branch_id", "product_id", "batch_no");
CREATE INDEX "inventory_movements_tenant_id_sales_invoice_line_id_idx" ON "inventory_movements"("tenant_id", "sales_invoice_line_id");
CREATE UNIQUE INDEX "inventory_movements_sales_invoice_line_id_batch_no_key" ON "inventory_movements"("sales_invoice_line_id", "batch_no");
CREATE TABLE "new_sales_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issued_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branch_id" TEXT,
    "customer_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount_total" REAL NOT NULL DEFAULT 0,
    "tax_total" REAL NOT NULL DEFAULT 0,
    "grand_total" REAL NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sales_invoices" ("created_at", "created_by_user_id", "currency", "customer_id", "discount_total", "grand_total", "id", "invoice_no", "issued_at", "status", "subtotal", "tax_total", "tenant_id", "updated_at") SELECT "created_at", "created_by_user_id", "currency", "customer_id", "discount_total", "grand_total", "id", "invoice_no", "issued_at", "status", "subtotal", "tax_total", "tenant_id", "updated_at" FROM "sales_invoices";
DROP TABLE "sales_invoices";
ALTER TABLE "new_sales_invoices" RENAME TO "sales_invoices";
CREATE INDEX "sales_invoices_tenant_id_issued_at_idx" ON "sales_invoices"("tenant_id", "issued_at");
CREATE INDEX "sales_invoices_tenant_id_status_created_at_idx" ON "sales_invoices"("tenant_id", "status", "created_at");
CREATE INDEX "sales_invoices_tenant_id_customer_id_idx" ON "sales_invoices"("tenant_id", "customer_id");
CREATE INDEX "sales_invoices_tenant_id_branch_id_idx" ON "sales_invoices"("tenant_id", "branch_id");
CREATE UNIQUE INDEX "sales_invoices_tenant_id_invoice_no_key" ON "sales_invoices"("tenant_id", "invoice_no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
