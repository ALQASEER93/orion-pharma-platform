-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_no" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_balances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "inventory_balances_tenant_id_branch_id_product_id_idx" ON "inventory_balances"("tenant_id", "branch_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_tenant_id_branch_id_product_id_batch_no_key" ON "inventory_balances"("tenant_id", "branch_id", "product_id", "batch_no");

-- Backfill balances from existing ledger rows so stock checks remain accurate.
INSERT INTO "inventory_balances" (
    "id",
    "tenant_id",
    "branch_id",
    "product_id",
    "batch_no",
    "quantity",
    "created_at",
    "updated_at"
)
SELECT
    lower(hex(randomblob(16))),
    "tenant_id",
    "branch_id",
    "product_id",
    COALESCE("batch_no", ''),
    COALESCE(SUM("quantity"), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "inventory_movements"
GROUP BY
    "tenant_id",
    "branch_id",
    "product_id",
    COALESCE("batch_no", '');
