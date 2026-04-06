CREATE TABLE "fiscal_sale_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT,
    "document_no" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "credit_state" TEXT NOT NULL DEFAULT 'NONE',
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount_total" REAL NOT NULL DEFAULT 0,
    "tax_total" REAL NOT NULL DEFAULT 0,
    "grand_total" REAL NOT NULL DEFAULT 0,
    "finalized_at" DATETIME,
    "queued_at" DATETIME,
    "accepted_at" DATETIME,
    "rejected_at" DATETIME,
    "cancelled_at" DATETIME,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "inventory_anchor_reference_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "fiscal_sale_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_sale_documents_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_sale_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fiscal_sale_documents_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_sale_documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "fiscal_sale_document_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sale_document_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL DEFAULT 1,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL,
    "line_total" REAL NOT NULL DEFAULT 0,
    "reference_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_sale_document_lines_sale_document_id_fkey" FOREIGN KEY ("sale_document_id") REFERENCES "fiscal_sale_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_sale_document_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_sale_document_lines_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fiscal_sale_document_lines_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "fiscal_return_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT,
    "source_sale_document_id" TEXT,
    "document_no" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount_total" REAL NOT NULL DEFAULT 0,
    "tax_total" REAL NOT NULL DEFAULT 0,
    "grand_total" REAL NOT NULL DEFAULT 0,
    "finalized_at" DATETIME,
    "queued_at" DATETIME,
    "accepted_at" DATETIME,
    "rejected_at" DATETIME,
    "cancelled_at" DATETIME,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "inventory_anchor_reference_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "fiscal_return_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_documents_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_documents_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_documents_source_sale_document_id_fkey" FOREIGN KEY ("source_sale_document_id") REFERENCES "fiscal_sale_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "fiscal_return_document_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "return_document_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_sale_line_id" TEXT,
    "line_no" INTEGER NOT NULL DEFAULT 1,
    "product_pack_id" TEXT NOT NULL,
    "lot_batch_id" TEXT,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL,
    "line_total" REAL NOT NULL DEFAULT 0,
    "reason_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_return_document_lines_return_document_id_fkey" FOREIGN KEY ("return_document_id") REFERENCES "fiscal_return_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_document_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_document_lines_source_sale_line_id_fkey" FOREIGN KEY ("source_sale_line_id") REFERENCES "fiscal_sale_document_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_document_lines_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fiscal_return_document_lines_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "fiscal_credit_note_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT,
    "source_sale_document_id" TEXT,
    "source_return_document_id" TEXT,
    "document_no" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount_total" REAL NOT NULL DEFAULT 0,
    "tax_total" REAL NOT NULL DEFAULT 0,
    "grand_total" REAL NOT NULL DEFAULT 0,
    "finalized_at" DATETIME,
    "queued_at" DATETIME,
    "accepted_at" DATETIME,
    "rejected_at" DATETIME,
    "cancelled_at" DATETIME,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "inventory_anchor_reference_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "fiscal_credit_note_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_documents_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_documents_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_documents_source_sale_document_id_fkey" FOREIGN KEY ("source_sale_document_id") REFERENCES "fiscal_sale_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_documents_source_return_document_id_fkey" FOREIGN KEY ("source_return_document_id") REFERENCES "fiscal_return_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "fiscal_credit_note_document_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credit_note_document_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_sale_line_id" TEXT,
    "source_return_line_id" TEXT,
    "line_no" INTEGER NOT NULL DEFAULT 1,
    "product_pack_id" TEXT,
    "lot_batch_id" TEXT,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax_rate" REAL,
    "line_total" REAL NOT NULL DEFAULT 0,
    "reason_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_credit_note_document_lines_credit_note_document_id_fkey" FOREIGN KEY ("credit_note_document_id") REFERENCES "fiscal_credit_note_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_document_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_document_lines_source_sale_line_id_fkey" FOREIGN KEY ("source_sale_line_id") REFERENCES "fiscal_sale_document_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_document_lines_source_return_line_id_fkey" FOREIGN KEY ("source_return_line_id") REFERENCES "fiscal_return_document_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_document_lines_product_pack_id_fkey" FOREIGN KEY ("product_pack_id") REFERENCES "product_packs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fiscal_credit_note_document_lines_lot_batch_id_fkey" FOREIGN KEY ("lot_batch_id") REFERENCES "lot_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fiscal_sale_documents_tenant_id_document_no_key" ON "fiscal_sale_documents"("tenant_id", "document_no");
CREATE INDEX "fiscal_sale_documents_tenant_id_state_created_at_idx" ON "fiscal_sale_documents"("tenant_id", "state", "created_at");
CREATE INDEX "fiscal_sale_documents_tenant_id_branch_id_register_id_created_at_idx" ON "fiscal_sale_documents"("tenant_id", "branch_id", "register_id", "created_at");
CREATE INDEX "fiscal_sale_documents_tenant_id_legal_entity_id_created_at_idx" ON "fiscal_sale_documents"("tenant_id", "legal_entity_id", "created_at");

CREATE UNIQUE INDEX "fiscal_sale_document_lines_sale_document_id_line_no_key" ON "fiscal_sale_document_lines"("sale_document_id", "line_no");
CREATE INDEX "fiscal_sale_document_lines_tenant_id_sale_document_id_idx" ON "fiscal_sale_document_lines"("tenant_id", "sale_document_id");
CREATE INDEX "fiscal_sale_document_lines_tenant_id_product_pack_id_lot_batch_id_idx" ON "fiscal_sale_document_lines"("tenant_id", "product_pack_id", "lot_batch_id");

CREATE UNIQUE INDEX "fiscal_return_documents_tenant_id_document_no_key" ON "fiscal_return_documents"("tenant_id", "document_no");
CREATE INDEX "fiscal_return_documents_tenant_id_state_created_at_idx" ON "fiscal_return_documents"("tenant_id", "state", "created_at");
CREATE INDEX "fiscal_return_documents_tenant_id_branch_id_register_id_created_at_idx" ON "fiscal_return_documents"("tenant_id", "branch_id", "register_id", "created_at");
CREATE INDEX "fiscal_return_documents_tenant_id_source_sale_document_id_idx" ON "fiscal_return_documents"("tenant_id", "source_sale_document_id");

CREATE UNIQUE INDEX "fiscal_return_document_lines_return_document_id_line_no_key" ON "fiscal_return_document_lines"("return_document_id", "line_no");
CREATE INDEX "fiscal_return_document_lines_tenant_id_return_document_id_idx" ON "fiscal_return_document_lines"("tenant_id", "return_document_id");
CREATE INDEX "fiscal_return_document_lines_tenant_id_source_sale_line_id_idx" ON "fiscal_return_document_lines"("tenant_id", "source_sale_line_id");
CREATE INDEX "fiscal_return_document_lines_tenant_id_product_pack_id_lot_batch_id_idx" ON "fiscal_return_document_lines"("tenant_id", "product_pack_id", "lot_batch_id");

CREATE UNIQUE INDEX "fiscal_credit_note_documents_tenant_id_document_no_key" ON "fiscal_credit_note_documents"("tenant_id", "document_no");
CREATE INDEX "fiscal_credit_note_documents_tenant_id_state_created_at_idx" ON "fiscal_credit_note_documents"("tenant_id", "state", "created_at");
CREATE INDEX "fiscal_credit_note_documents_tenant_id_branch_id_register_id_created_at_idx" ON "fiscal_credit_note_documents"("tenant_id", "branch_id", "register_id", "created_at");
CREATE INDEX "fiscal_credit_note_documents_tenant_id_source_sale_document_id_idx" ON "fiscal_credit_note_documents"("tenant_id", "source_sale_document_id");
CREATE INDEX "fiscal_credit_note_documents_tenant_id_source_return_document_id_idx" ON "fiscal_credit_note_documents"("tenant_id", "source_return_document_id");

CREATE UNIQUE INDEX "fiscal_credit_note_document_lines_credit_note_document_id_line_no_key" ON "fiscal_credit_note_document_lines"("credit_note_document_id", "line_no");
CREATE INDEX "fiscal_credit_note_document_lines_tenant_id_credit_note_document_id_idx" ON "fiscal_credit_note_document_lines"("tenant_id", "credit_note_document_id");
CREATE INDEX "fiscal_credit_note_document_lines_tenant_id_source_sale_line_id_idx" ON "fiscal_credit_note_document_lines"("tenant_id", "source_sale_line_id");
CREATE INDEX "fiscal_credit_note_document_lines_tenant_id_source_return_line_id_idx" ON "fiscal_credit_note_document_lines"("tenant_id", "source_return_line_id");
CREATE INDEX "fiscal_credit_note_document_lines_tenant_id_product_pack_id_lot_batch_id_idx" ON "fiscal_credit_note_document_lines"("tenant_id", "product_pack_id", "lot_batch_id");
