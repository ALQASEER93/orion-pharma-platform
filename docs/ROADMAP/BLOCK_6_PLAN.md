# Block 6 Plan - Dashboards, KPIs, and Decision System

## Objective
Implement a trusted intelligence layer that turns operational and accounting data into tenant-safe, decision-grade KPIs and dashboards.

## Slice 1 - KPI Canonical Definitions and Metric Contracts
- Scope:
  - Create canonical KPI dictionary and metric SQL/query contracts.
- Deliverables:
  - KPI spec file in repo (metric name, formula, grain, filters, owner).
  - Technical contract between `@orion/intelligence` and API/reporting endpoints.
- Acceptance Criteria:
  - Every KPI has a single canonical definition.
  - Formula lineage references source entities/fields.
  - Definitions are approved and versioned.

## Slice 2 - Data Mart and Aggregation Layer
- Scope:
  - Build reusable tenant-scoped aggregate tables/views.
- Data:
  - Daily snapshots for sales, procurement, inventory, AR/AP, cash.
- Runtime:
  - Incremental refresh jobs with backfill support.
- Acceptance Criteria:
  - Aggregates refresh within target window.
  - Late-arriving data is handled idempotently.
  - No cross-tenant data leakage in aggregate storage.

## Slice 3 - Sales and Procurement Dashboards
- Scope:
  - Deliver MVP operational dashboards.
- UI:
  - `/dashboards/sales`
  - `/dashboards/procurement`
- KPI examples:
  - Net sales, gross margin %, average basket size, return rate.
  - Purchase cycle time, supplier fill rate, PO-to-GRN lead time.
- Acceptance Criteria:
  - Dashboard totals reconcile with source reports for sampled periods.
  - Branch/date filters are consistent across widgets.

## Slice 4 - Finance and Working Capital Dashboards
- Scope:
  - Build finance dashboards grounded in Block 5 postings.
- UI:
  - `/dashboards/finance`
- KPI examples:
  - AR aging, AP aging, inventory value, cash conversion cycle proxy.
- Acceptance Criteria:
  - Finance KPIs reconcile with trial balance and subledgers.
  - KPI calculations are traceable to journalized data.

## Slice 5 - Alerts, Thresholds, and Exception Monitoring
- Scope:
  - Add configurable thresholds and anomaly alerts.
- API/UI:
  - Alert rule CRUD and alert inbox.
- Examples:
  - Negative margin products, unusual return spikes, slow-moving stock.
- Acceptance Criteria:
  - Alerts are tenant-configurable without code changes.
  - Alert records include drill-down links to source transactions.

## Slice 6 - Decision Workspace and Drill-Down
- Scope:
  - Build decision workspace with KPI -> transaction drill path.
- UI:
  - Drill from dashboard card to filtered lists and document details.
- Acceptance Criteria:
  - User can trace each KPI value to underlying rows.
  - Role permissions consistently applied from summary to detail.

## Slice 7 - Intelligence Reliability and Governance (Block 6 Exit)
- Scope:
  - Monitoring, tests, and SLA for data freshness/accuracy.
- Deliverables:
  - Freshness checks, reconciliation checks, observability logs.
- Acceptance Criteria:
  - KPI freshness and accuracy SLAs are measurable.
  - Regression tests protect KPI contracts.
  - Block 6 release requires QuickGate + RunPack pass and clean KPI reconciliation report.

## Block 6 Dependencies
- Depends on Block 5 journalized finance model for trusted finance KPIs.
- Depends on Block 4 complete sales/procurement lifecycle for operational KPIs.
- Depends on tenant-safe shared primitives in `@orion/*` packages.
