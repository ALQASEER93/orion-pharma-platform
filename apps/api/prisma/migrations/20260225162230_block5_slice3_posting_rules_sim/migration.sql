-- CreateTable
CREATE TABLE "posting_rule_sets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "posting_rule_sets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "posting_rule_sets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "posting_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "rule_set_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "debit_account_code" TEXT NOT NULL,
    "credit_account_code" TEXT NOT NULL,
    "amount_expr" TEXT NOT NULL,
    "memo_template" TEXT,
    "conditions_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "posting_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "posting_rules_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "posting_rule_sets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "posting_rule_sets_tenant_id_status_effective_from_effective_to_idx" ON "posting_rule_sets"("tenant_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "posting_rule_sets_tenant_id_name_version_key" ON "posting_rule_sets"("tenant_id", "name", "version");

-- CreateIndex
CREATE INDEX "posting_rules_tenant_id_rule_set_id_event_type_is_active_priority_idx" ON "posting_rules"("tenant_id", "rule_set_id", "event_type", "is_active", "priority");

