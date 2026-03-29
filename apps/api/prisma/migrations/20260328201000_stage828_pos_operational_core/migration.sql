CREATE TABLE "pos_cart_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "session_number" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount_total" REAL NOT NULL DEFAULT 0,
    "tax_total" REAL NOT NULL DEFAULT 0,
    "grand_total" REAL NOT NULL DEFAULT 0,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" DATETIME,
    "cancelled_at" DATETIME,
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "fiscal_sale_document_id" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pos_cart_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_sessions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_sessions_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_sessions_fiscal_sale_document_id_fkey" FOREIGN KEY ("fiscal_sale_document_id") REFERENCES "fiscal_sale_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "pos_cart_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cart_session_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL DEFAULT 1,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL,
    "line_total" REAL NOT NULL DEFAULT 0,
    "fiscal_sale_line_id" TEXT,
    "inventory_ledger_entry_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_cart_lines_cart_session_id_fkey" FOREIGN KEY ("cart_session_id") REFERENCES "pos_cart_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_lines_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_lines_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_lines_fiscal_sale_line_id_fkey" FOREIGN KEY ("fiscal_sale_line_id") REFERENCES "fiscal_sale_document_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_cart_lines_inventory_ledger_entry_id_fkey" FOREIGN KEY ("inventory_ledger_entry_id") REFERENCES "inventory_ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "pos_return_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "source_sale_document_id" TEXT,
    "return_number" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount_total" REAL NOT NULL DEFAULT 0,
    "tax_total" REAL NOT NULL DEFAULT 0,
    "grand_total" REAL NOT NULL DEFAULT 0,
    "reason_code" TEXT,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" DATETIME,
    "cancelled_at" DATETIME,
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "fiscal_return_document_id" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pos_return_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_return_sessions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_return_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_return_sessions_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_return_sessions_source_sale_document_id_fkey" FOREIGN KEY ("source_sale_document_id") REFERENCES "fiscal_sale_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_return_sessions_fiscal_return_document_id_fkey" FOREIGN KEY ("fiscal_return_document_id") REFERENCES "fiscal_return_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_return_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "pos_return_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "return_session_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_sale_line_id" TEXT,
    "line_no" INTEGER NOT NULL DEFAULT 1,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT NOT NULL,
    "quantity_returned" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL,
    "line_total" REAL NOT NULL DEFAULT 0,
    "reason_code" TEXT,
    "fiscal_return_line_id" TEXT,
    "inventory_ledger_entry_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_return_lines_return_session_id_fkey" FOREIGN KEY ("return_session_id") REFERENCES "pos_return_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_return_lines_source_sale_line_id_fkey" FOREIGN KEY ("source_sale_line_id") REFERENCES "fiscal_sale_document_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_return_lines_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_return_lines_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_return_lines_fiscal_return_line_id_fkey" FOREIGN KEY ("fiscal_return_line_id") REFERENCES "fiscal_return_document_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_return_lines_inventory_ledger_entry_id_fkey" FOREIGN KEY ("inventory_ledger_entry_id") REFERENCES "inventory_ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "pos_payment_finalizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "cart_session_id" TEXT,
    "return_session_id" TEXT,
    "fiscal_sale_document_id" TEXT,
    "fiscal_return_document_id" TEXT,
    "flow_type" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT NOT NULL,
    "amount_applied" REAL NOT NULL,
    "amount_tendered" REAL,
    "change_amount" REAL NOT NULL DEFAULT 0,
    "reference_code" TEXT,
    "notes" TEXT,
    "finalized_at" DATETIME,
    "cancelled_at" DATETIME,
    "cancellation_reason" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pos_payment_finalizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_cart_session_id_fkey" FOREIGN KEY ("cart_session_id") REFERENCES "pos_cart_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_return_session_id_fkey" FOREIGN KEY ("return_session_id") REFERENCES "pos_return_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_fiscal_sale_document_id_fkey" FOREIGN KEY ("fiscal_sale_document_id") REFERENCES "fiscal_sale_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_fiscal_return_document_id_fkey" FOREIGN KEY ("fiscal_return_document_id") REFERENCES "fiscal_return_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_payment_finalizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pos_cart_sessions_tenant_id_session_number_key" ON "pos_cart_sessions"("tenant_id", "session_number");
CREATE UNIQUE INDEX "pos_cart_sessions_fiscal_sale_document_id_key" ON "pos_cart_sessions"("fiscal_sale_document_id");
CREATE INDEX "pos_cart_sessions_tenant_id_branch_id_register_id_state_opened_at_idx" ON "pos_cart_sessions"("tenant_id", "branch_id", "register_id", "state", "opened_at");
CREATE INDEX "pos_cart_sessions_tenant_id_legal_entity_id_state_opened_at_idx" ON "pos_cart_sessions"("tenant_id", "legal_entity_id", "state", "opened_at");

CREATE UNIQUE INDEX "pos_cart_lines_cart_session_id_line_no_key" ON "pos_cart_lines"("cart_session_id", "line_no");
CREATE UNIQUE INDEX "pos_cart_lines_fiscal_sale_line_id_key" ON "pos_cart_lines"("fiscal_sale_line_id");
CREATE UNIQUE INDEX "pos_cart_lines_inventory_ledger_entry_id_key" ON "pos_cart_lines"("inventory_ledger_entry_id");
CREATE INDEX "pos_cart_lines_tenant_id_cart_session_id_idx" ON "pos_cart_lines"("tenant_id", "cart_session_id");
CREATE INDEX "pos_cart_lines_tenant_id_product_pack_id_lot_batch_id_idx" ON "pos_cart_lines"("tenant_id", "product_pack_id", "lot_batch_id");

CREATE UNIQUE INDEX "pos_return_sessions_tenant_id_return_number_key" ON "pos_return_sessions"("tenant_id", "return_number");
CREATE UNIQUE INDEX "pos_return_sessions_fiscal_return_document_id_key" ON "pos_return_sessions"("fiscal_return_document_id");
CREATE INDEX "pos_return_sessions_tenant_id_branch_id_register_id_state_opened_at_idx" ON "pos_return_sessions"("tenant_id", "branch_id", "register_id", "state", "opened_at");
CREATE INDEX "pos_return_sessions_tenant_id_source_sale_document_id_idx" ON "pos_return_sessions"("tenant_id", "source_sale_document_id");

CREATE UNIQUE INDEX "pos_return_lines_return_session_id_line_no_key" ON "pos_return_lines"("return_session_id", "line_no");
CREATE UNIQUE INDEX "pos_return_lines_fiscal_return_line_id_key" ON "pos_return_lines"("fiscal_return_line_id");
CREATE UNIQUE INDEX "pos_return_lines_inventory_ledger_entry_id_key" ON "pos_return_lines"("inventory_ledger_entry_id");
CREATE INDEX "pos_return_lines_tenant_id_return_session_id_idx" ON "pos_return_lines"("tenant_id", "return_session_id");
CREATE INDEX "pos_return_lines_tenant_id_source_sale_line_id_idx" ON "pos_return_lines"("tenant_id", "source_sale_line_id");
CREATE INDEX "pos_return_lines_tenant_id_product_pack_id_lot_batch_id_idx" ON "pos_return_lines"("tenant_id", "product_pack_id", "lot_batch_id");

CREATE INDEX "pos_payment_finalizations_tenant_id_branch_id_register_id_flow_type_created_at_idx" ON "pos_payment_finalizations"("tenant_id", "branch_id", "register_id", "flow_type", "created_at");
CREATE INDEX "pos_payment_finalizations_tenant_id_cart_session_id_idx" ON "pos_payment_finalizations"("tenant_id", "cart_session_id");
CREATE INDEX "pos_payment_finalizations_tenant_id_return_session_id_idx" ON "pos_payment_finalizations"("tenant_id", "return_session_id");
CREATE INDEX "pos_payment_finalizations_tenant_id_fiscal_sale_document_id_idx" ON "pos_payment_finalizations"("tenant_id", "fiscal_sale_document_id");
CREATE INDEX "pos_payment_finalizations_tenant_id_fiscal_return_document_id_idx" ON "pos_payment_finalizations"("tenant_id", "fiscal_return_document_id");
