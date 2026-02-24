ALTER TABLE "goods_receipt_lines"
ADD COLUMN "returned_quantity" INTEGER NOT NULL DEFAULT 0;

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "purchase_return_lines";
DROP TABLE IF EXISTS "purchase_returns";

CREATE TABLE "purchase_returns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "reason_code" TEXT,
    "notes" TEXT,
    "returned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by" TEXT,
    CONSTRAINT "purchase_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "purchase_return_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchase_return_id" TEXT NOT NULL,
    "goods_receipt_line_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "inventory_movement_id" TEXT,
    "qty_returned_now" INTEGER NOT NULL,
    "reason_code" TEXT,
    "batch_no" TEXT,
    "expiry_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_return_lines_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_return_lines_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_lines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_return_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_return_lines_inventory_movement_id_fkey" FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "purchase_returns_tenant_id_return_number_key" ON "purchase_returns"("tenant_id", "return_number");
CREATE UNIQUE INDEX "purchase_returns_tenant_id_idempotency_key_key" ON "purchase_returns"("tenant_id", "idempotency_key");
CREATE INDEX "purchase_returns_tenant_id_returned_at_idx" ON "purchase_returns"("tenant_id", "returned_at");
CREATE INDEX "purchase_returns_tenant_id_goods_receipt_id_idx" ON "purchase_returns"("tenant_id", "goods_receipt_id");
CREATE INDEX "purchase_returns_tenant_id_supplier_id_idx" ON "purchase_returns"("tenant_id", "supplier_id");

CREATE UNIQUE INDEX "purchase_return_lines_inventory_movement_id_key" ON "purchase_return_lines"("inventory_movement_id");
CREATE INDEX "purchase_return_lines_tenant_id_purchase_return_id_idx" ON "purchase_return_lines"("tenant_id", "purchase_return_id");
CREATE INDEX "purchase_return_lines_tenant_id_goods_receipt_line_id_idx" ON "purchase_return_lines"("tenant_id", "goods_receipt_line_id");
CREATE INDEX "purchase_return_lines_tenant_id_product_id_idx" ON "purchase_return_lines"("tenant_id", "product_id");

PRAGMA foreign_keys=ON;
