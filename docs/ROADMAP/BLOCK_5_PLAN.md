# Block 5 Plan - Accounting (GL, AR, AP, Inventory Valuation)

## Objective
Establish a tenant-configurable accounting core that receives operational events from procurement/sales/inventory and produces auditable journals, ledgers, and close-ready statements.

## Slice 1 - Accounting Foundation and Chart of Accounts
- Scope:
  - Build accounting domain schema and APIs for chart of accounts (CoA).
- API:
  - `GET /api/accounting/accounts`
  - `POST /api/accounting/accounts`
  - `PATCH /api/accounting/accounts/:id`
- Data:
  - Add `Account`, `AccountType`, `AccountBalanceSnapshot`, `FiscalPeriod`.
- Package:
  - Start real implementation inside `@orion/accounting` and consume from API.
- Acceptance Criteria:
  - Tenant-scoped CoA with unique account code per tenant.
  - Supports active/inactive and posting-allowed flags.
  - Migration + API tests pass.

## Slice 2 - Journal Engine and Posting Runtime
- Scope:
  - Implement double-entry journal runtime with idempotent posting keys.
- API:
  - Internal posting endpoint/service for domain events.
  - Read endpoint: `GET /api/accounting/journals`.
- Data:
  - `JournalEntry`, `JournalLine`, `PostingKeyRegistry`.
- Rules:
  - Debit = Credit per journal, hard validation.
- Acceptance Criteria:
  - Each posting request is idempotent by tenant + source type + source id.
  - Out-of-balance journal is rejected.
  - Full audit metadata recorded (who/when/source).

## Slice 3 - Posting Rule Configuration (Tenant-Configurable)
- Scope:
  - Replace hardcoded accounting mapping with per-tenant rule configuration.
- API:
  - `GET /api/accounting/posting-rules`
  - `POST /api/accounting/posting-rules`
  - `PATCH /api/accounting/posting-rules/:id`
- Data:
  - `PostingRuleSet`, `PostingRule`, `PostingCondition`, `EffectiveDate`.
- Acceptance Criteria:
  - Rules selected by event type + conditions + effective date.
  - Rule simulation endpoint returns deterministic journal preview.
  - No service contains tenant-specific hardcoded account IDs.

## Slice 4 - AR Subledger (Customer Balances)
- Scope:
  - Build receivables tracking from posted sales, returns, and payments.
- API:
  - `GET /api/accounting/ar/customers`
  - `GET /api/accounting/ar/aging`
  - `POST /api/accounting/ar/manual-adjustments`
- Data:
  - `ArLedgerEntry`, settlement references to sales docs/payments.
- Acceptance Criteria:
  - Customer balances reconcile with AR control account.
  - Aging buckets are reproducible and tested.
  - Credit memo/return effect reflected in AR.

## Slice 5 - AP Subledger (Supplier Balances)
- Scope:
  - Build payables tracking from procurement and supplier returns/payments.
- API:
  - `GET /api/accounting/ap/suppliers`
  - `GET /api/accounting/ap/aging`
  - `POST /api/accounting/ap/manual-adjustments`
- Data:
  - `ApLedgerEntry`, settlements against supplier obligations.
- Acceptance Criteria:
  - Supplier balances reconcile with AP control account.
  - Return/adjustment effects flow into AP.

## Slice 6 - Inventory Valuation and COGS Posting
- Scope:
  - Introduce valuation engine linked to inventory movements and sales postings.
- API:
  - `GET /api/accounting/inventory/valuation`
  - `POST /api/accounting/inventory/rebuild-valuation` (admin controlled)
- Data:
  - `InventoryCostLayer` or moving-average snapshots, `CogsPostingRef`.
- Acceptance Criteria:
  - Every stock-affecting event has cost basis for accounting.
  - COGS and inventory asset postings are generated on sale/return.
  - Valuation report reconciles with inventory balances and GL control.

## Slice 7 - Period Close, Trial Balance, and Financial Statements
- Scope:
  - Closing workflow and statement generation.
- API:
  - `POST /api/accounting/periods/:id/close`
  - `GET /api/accounting/trial-balance`
  - `GET /api/accounting/statements/pnl`
  - `GET /api/accounting/statements/balance-sheet`
- Data:
  - Close snapshot tables and period lock state.
- Acceptance Criteria:
  - Closed period blocks operational/accounting backdated changes unless authorized reopen.
  - Trial balance totals are consistent and deterministic.
  - P&L and Balance Sheet derive from journals without manual edits.

## Slice 8 - Reconciliation, Controls, and Auditability (Block 5 Exit)
- Scope:
  - Add reconciliation reports and control checks.
- API:
  - `GET /api/accounting/reconciliation/subledger-vs-gl`
  - `GET /api/accounting/audit/posting-exceptions`
- Acceptance Criteria:
  - Automated checks detect subledger/GL mismatches.
  - Exception list includes actionable source references.
  - Block 5 is considered complete only if all control reports are clean or explicitly waived.

## Block 5 Dependencies
- Requires Block 4 stock and sales lifecycle hardening.
- Requires final decisions on negative stock, valuation method, and tax posting policy.

## Block 5 Exit Gate
- All slices accepted.
- QuickGate + RunPack pass with evidence in `docs/_runs` and `LATEST.txt` updated.
