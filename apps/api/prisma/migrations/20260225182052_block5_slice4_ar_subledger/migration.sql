-- CreateTable
CREATE TABLE "ar_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT NOT NULL,
    "journal_entry_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "invoice_no" TEXT NOT NULL,
    "issue_date" DATETIME NOT NULL,
    "due_date" DATETIME,
    "original_amount" REAL NOT NULL,
    "paid_amount" REAL NOT NULL DEFAULT 0,
    "outstanding_amount" REAL NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ar_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ar_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ar_invoices_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ar_invoices_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ar_invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ar_receipts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "journal_entry_id" TEXT,
    "receipt_no" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ar_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ar_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ar_receipts_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ar_receipts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ar_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ar_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ar_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "ar_receipts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ar_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "ar_invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ar_invoices_sales_invoice_id_key" ON "ar_invoices"("sales_invoice_id");

-- CreateIndex
CREATE INDEX "ar_invoices_tenant_id_status_issue_date_idx" ON "ar_invoices"("tenant_id", "status", "issue_date");

-- CreateIndex
CREATE INDEX "ar_invoices_tenant_id_customer_id_status_idx" ON "ar_invoices"("tenant_id", "customer_id", "status");

-- CreateIndex
CREATE INDEX "ar_receipts_tenant_id_status_date_idx" ON "ar_receipts"("tenant_id", "status", "date");

-- CreateIndex
CREATE INDEX "ar_receipts_tenant_id_customer_id_status_idx" ON "ar_receipts"("tenant_id", "customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ar_receipts_tenant_id_receipt_no_key" ON "ar_receipts"("tenant_id", "receipt_no");

-- CreateIndex
CREATE INDEX "ar_allocations_tenant_id_receipt_id_idx" ON "ar_allocations"("tenant_id", "receipt_id");

-- CreateIndex
CREATE INDEX "ar_allocations_tenant_id_invoice_id_idx" ON "ar_allocations"("tenant_id", "invoice_id");

