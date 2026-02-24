CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issued_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "sales_invoice_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT,
    "item_name" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL,
    "line_total" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_invoice_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_invoice_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "sales_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sales_invoices_tenant_id_invoice_no_key" ON "sales_invoices"("tenant_id", "invoice_no");
CREATE INDEX "sales_invoices_tenant_id_issued_at_idx" ON "sales_invoices"("tenant_id", "issued_at");
CREATE INDEX "sales_invoices_tenant_id_status_created_at_idx" ON "sales_invoices"("tenant_id", "status", "created_at");
CREATE INDEX "sales_invoices_tenant_id_customer_id_idx" ON "sales_invoices"("tenant_id", "customer_id");

CREATE INDEX "sales_invoice_lines_tenant_id_invoice_id_idx" ON "sales_invoice_lines"("tenant_id", "invoice_id");
CREATE INDEX "sales_invoice_lines_tenant_id_product_id_idx" ON "sales_invoice_lines"("tenant_id", "product_id");

CREATE INDEX "sales_payments_tenant_id_invoice_id_paid_at_idx" ON "sales_payments"("tenant_id", "invoice_id", "paid_at");
