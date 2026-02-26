-- CreateTable
CREATE TABLE "period_closes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "fiscal_period_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "closed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "period_closes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "period_closes_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "period_closes_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trial_balance_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "fiscal_period_id" TEXT NOT NULL,
    "as_of_date" DATETIME NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trial_balance_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trial_balance_snapshots_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "statement_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "fiscal_period_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "statement_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "statement_snapshots_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "period_closes_tenant_id_fiscal_period_id_created_at_idx" ON "period_closes"("tenant_id", "fiscal_period_id", "created_at");

-- CreateIndex
CREATE INDEX "period_closes_tenant_id_status_created_at_idx" ON "period_closes"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "trial_balance_snapshots_tenant_id_fiscal_period_id_created_at_idx" ON "trial_balance_snapshots"("tenant_id", "fiscal_period_id", "created_at");

-- CreateIndex
CREATE INDEX "statement_snapshots_tenant_id_fiscal_period_id_type_created_at_idx" ON "statement_snapshots"("tenant_id", "fiscal_period_id", "type", "created_at");
