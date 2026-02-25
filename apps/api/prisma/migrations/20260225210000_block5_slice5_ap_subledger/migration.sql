-- CreateTable
CREATE TABLE "ap_bills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "bill_no" TEXT NOT NULL,
    "issue_date" DATETIME NOT NULL,
    "due_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "original_amount" REAL NOT NULL,
    "paid_amount" REAL NOT NULL DEFAULT 0,
    "outstanding_amount" REAL NOT NULL,
    "journal_entry_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ap_bills_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ap_bills_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ap_bills_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ap_bills_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ap_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "payment_no" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "journal_entry_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ap_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ap_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ap_payments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ap_payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ap_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ap_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ap_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "ap_payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ap_allocations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "ap_bills" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ap_bills_tenant_id_bill_no_key" ON "ap_bills"("tenant_id", "bill_no");

-- CreateIndex
CREATE INDEX "ap_bills_tenant_id_status_issue_date_idx" ON "ap_bills"("tenant_id", "status", "issue_date");

-- CreateIndex
CREATE INDEX "ap_bills_tenant_id_supplier_id_status_idx" ON "ap_bills"("tenant_id", "supplier_id", "status");

-- CreateIndex
CREATE INDEX "ap_bills_tenant_id_source_type_source_id_idx" ON "ap_bills"("tenant_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "ap_payments_tenant_id_payment_no_key" ON "ap_payments"("tenant_id", "payment_no");

-- CreateIndex
CREATE INDEX "ap_payments_tenant_id_status_date_idx" ON "ap_payments"("tenant_id", "status", "date");

-- CreateIndex
CREATE INDEX "ap_payments_tenant_id_supplier_id_status_idx" ON "ap_payments"("tenant_id", "supplier_id", "status");

-- CreateIndex
CREATE INDEX "ap_allocations_tenant_id_payment_id_idx" ON "ap_allocations"("tenant_id", "payment_id");

-- CreateIndex
CREATE INDEX "ap_allocations_tenant_id_bill_id_idx" ON "ap_allocations"("tenant_id", "bill_id");
