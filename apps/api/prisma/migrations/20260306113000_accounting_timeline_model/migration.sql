PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_no" TEXT,
    "expiry_date" DATETIME,
    "business_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

INSERT INTO "new_inventory_movements" (
    "id",
    "tenant_id",
    "branch_id",
    "product_id",
    "batch_no",
    "expiry_date",
    "business_date",
    "movement_type",
    "quantity",
    "unit_cost",
    "cost_total",
    "reason",
    "created_at",
    "created_by",
    "sales_invoice_line_id"
)
SELECT
    "id",
    "tenant_id",
    "branch_id",
    "product_id",
    "batch_no",
    "expiry_date",
    "created_at",
    "movement_type",
    "quantity",
    "unit_cost",
    "cost_total",
    "reason",
    "created_at",
    "created_by",
    "sales_invoice_line_id"
FROM "inventory_movements";

DROP TABLE "inventory_movements";
ALTER TABLE "new_inventory_movements" RENAME TO "inventory_movements";

CREATE INDEX "inventory_movements_tenant_id_branch_id_product_id_batch_no_idx"
ON "inventory_movements"("tenant_id", "branch_id", "product_id", "batch_no");

CREATE INDEX "inventory_movements_tenant_id_business_date_idx"
ON "inventory_movements"("tenant_id", "business_date");

CREATE INDEX "inventory_movements_tenant_id_sales_invoice_line_id_idx"
ON "inventory_movements"("tenant_id", "sales_invoice_line_id");

CREATE UNIQUE INDEX "inventory_movements_sales_invoice_line_id_batch_no_key"
ON "inventory_movements"("sales_invoice_line_id", "batch_no");

ALTER TABLE "ar_invoices"
ADD COLUMN "voided_at" DATETIME;

ALTER TABLE "ap_bills"
ADD COLUMN "voided_at" DATETIME;

CREATE INDEX "ar_invoices_tenant_id_voided_at_idx"
ON "ar_invoices"("tenant_id", "voided_at");

CREATE INDEX "ap_bills_tenant_id_voided_at_idx"
ON "ap_bills"("tenant_id", "voided_at");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
