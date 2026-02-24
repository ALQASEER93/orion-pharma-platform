# ORION Pharma Platform Master Plan

## Scope Baseline (Current Repo State)

### Implemented Foundations
- API modules live in `apps/api/src`: auth, taxonomy, products, inventory, suppliers, customers, purchase-orders, goods-receipts, procurement-transactions, procurement-reports, sales.
- Data model in `apps/api/prisma/schema.prisma` includes tenant/branch/user RBAC, product/inventory, procurement (PO/GRN/returns/adjustments), and sales invoice + payment entities.
- Web routes in `apps/web/src/app`: `/`, `/products`, `/suppliers`, `/purchase-orders`, `/stock`, `/sales/invoices`, `/pos`.
- Validation scripts exist and are active:
  - `scripts/quickgate.ps1` (install, lint, typecheck, unit tests)
  - `scripts/runpack.ps1` (full validation + evidence packaging under `docs/_runs`)
- Shared package namespace is established (`@orion/*`), but domain packages `@orion/accounting` and `@orion/intelligence` are currently placeholders.

### Not Yet Implemented (Platform Gaps)
- Block 4 beyond Slice 2 (sales returns/exchanges, branch shift controls, promotions/discount governance, audit-grade cash settlement).
- Block 5 full accounting engine (chart of accounts, journal posting engine, GL/AR/AP, inventory valuation and COGS posting, closing and reconciliation).
- Block 6 decision system (KPI layer, tenant-safe semantic metrics, operational/financial dashboards, alerting).

## Horizon Roadmap

### Horizon 0 (Now, 0-2 weeks): Planning and Control Baseline
- Finalize roadmap blocks and open decisions.
- Lock Definition of Done and evidence governance.
- Keep delivery branch-only (`codex/*`) and PR-based.
- Deliverables:
  - `docs/ROADMAP/MASTER_PLAN.md`
  - `docs/ROADMAP/BLOCK_4_PLAN.md`
  - `docs/ROADMAP/BLOCK_5_PLAN.md`
  - `docs/ROADMAP/BLOCK_6_PLAN.md`
  - `docs/DECISIONS/OPEN_DECISIONS.md`
  - `docs/OPERATIONS/DEFINITION_OF_DONE.md`

### Horizon 1 (Near Term, 2-8 weeks): Block 4 Completion (Sales + POS)
- Complete operational sales flows from current invoice/POS baseline into production-ready multi-branch behavior.
- Focus on stock integrity, payment controls, and branch-safe daily operations.
- Exit criteria:
  - Block 4 slices completed with acceptance criteria in `BLOCK_4_PLAN.md`.
  - No high-severity integrity gaps in POS/inventory coupling.

### Horizon 2 (Mid Term, 8-16 weeks): Block 5 (Accounting Core)
- Implement accounting foundation with configurable posting rules per tenant.
- Add GL/AR/AP subledgers and inventory valuation + COGS.
- Establish month-end controls and reconciliation routines.
- Exit criteria:
  - Financial statements reproducible from journals.
  - Accounting postings deterministic, idempotent, and auditable.

### Horizon 3 (Scale, 16-24 weeks): Block 6 (Dashboards and Decision System)
- Build KPI model and dashboards for Sales, Procurement, Inventory, and Finance.
- Add anomaly detection/alerts and drill-down to source transactions.
- Exit criteria:
  - Dashboard metrics reconcile to source and accounting data.
  - Tenant and branch access boundaries enforced in all aggregations.

## Cross-Block Dependencies
- Block 4 depends on stable inventory integrity rules from existing procurement and stock logic.
- Block 5 depends on Block 4 transaction completeness (sales, returns, inventory movement semantics).
- Block 6 depends on Block 5 ledgered truth for finance KPIs and on Block 4 operational completeness for commercial KPIs.
- All blocks depend on:
  - `ORION_*` environment governance.
  - `@orion/*` shared imports and reusable domain packages.
  - `docs/_runs` evidence policy with `LATEST.txt` alignment and 3-zip outputs.

## Definition of Done (Program Level)
- Slice-level DoD is defined per block doc and operationalized in `docs/OPERATIONS/DEFINITION_OF_DONE.md`.
- Program-level DoD requires:
  - Acceptance criteria met for each slice.
  - QuickGate pass.
  - RunPack pass (`overall_pass=true`, `blockers=[]`).
  - Evidence artifacts present only under `docs/_runs` and tracked via `docs/_runs/LATEST.txt`.
  - PR merged through merge-safe workflow, followed by post-merge RunPack on `main`.

## Risk Register (Top 10)
1. Stock/financial divergence between operational transactions and accounting postings.
- Mitigation: event-to-journal idempotency keys, reconciliation jobs, hard fail on unmatched postings.
2. Ambiguous negative stock behavior across flows (sale/return/adjustment).
- Mitigation: explicit policy decision, permission-gated override, full audit trail.
3. Inventory valuation complexity (cost layers) delays Block 5.
- Mitigation: phase valuation strategy; start with moving average, design for FIFO extension.
4. Tax rule variability by tenant and jurisdiction.
- Mitigation: rules table with effective dates; no hardcoded tax behavior in services.
5. Multi-branch sequence/document collisions.
- Mitigation: tenant-scoped sequences with branch-aware prefixes where needed.
6. Performance bottlenecks in reporting and dashboards.
- Mitigation: pre-aggregations/materialized views and indexed query paths.
7. Permission model drift between API and dashboard layers.
- Mitigation: centralized permission keys and automated authorization tests.
8. Incomplete close process (period locks, re-open controls).
- Mitigation: explicit closing workflow with roles and immutable close snapshots.
9. Evidence non-compliance (artifacts outside `docs/_runs`, stale `LATEST.txt`).
- Mitigation: keep runpack guardrails strict and enforce path checks in CI.
10. Scope creep across Blocks 4-6 reduces delivery cadence.
- Mitigation: strict slice boundaries, acceptance-based release gates, defer optional features.
