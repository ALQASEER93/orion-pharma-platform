-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN "received_quantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "grn_number" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "notes" TEXT,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by" TEXT,
    CONSTRAINT "goods_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goods_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goods_receipt_id" TEXT NOT NULL,
    "purchase_order_line_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "inventory_movement_id" TEXT,
    "qty_received_now" INTEGER NOT NULL,
    "batch_no" TEXT,
    "expiry_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goods_receipt_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goods_receipt_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goods_receipt_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "goods_receipt_lines_inventory_movement_id_fkey" FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenant_id_grn_number_key" ON "goods_receipts"("tenant_id", "grn_number");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenant_id_idempotency_key_key" ON "goods_receipts"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_id_received_at_idx" ON "goods_receipts"("tenant_id", "received_at");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_id_purchase_order_id_idx" ON "goods_receipts"("tenant_id", "purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_lines_inventory_movement_id_key" ON "goods_receipt_lines"("inventory_movement_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_tenant_id_goods_receipt_id_idx" ON "goods_receipt_lines"("tenant_id", "goods_receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_tenant_id_purchase_order_line_id_idx" ON "goods_receipt_lines"("tenant_id", "purchase_order_line_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_tenant_id_product_id_idx" ON "goods_receipt_lines"("tenant_id", "product_id");
