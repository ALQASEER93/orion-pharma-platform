# Block 4 Plan - Sales and POS (Slices 3..n)

## Current Baseline
- Already in place:
  - Sales invoice draft/post lifecycle and POS checkout endpoint (`/api/sales/invoices*`, `/api/pos/checkout`).
  - Sales invoice lines, payments, and customer linking in Prisma schema.
  - Minimal web UI pages for `/sales/invoices` and `/pos`.
- Remaining work starts from Slice 3.

## Slice 3 - Sales Return and Exchange
- Scope:
  - Add sales return document flow that references posted invoices and lines.
  - Support full return and partial return with controlled exchange flow.
- API:
  - `POST /api/sales/returns`
  - `GET /api/sales/returns`
  - `POST /api/sales/exchanges`
- Data:
  - Add `SalesReturn` + `SalesReturnLine` with tenant/branch scope and idempotency key.
  - Link return lines to original sales lines for traceability.
- UI:
  - Return from invoice view with reason code and restock behavior.
- Dependencies:
  - Existing sales invoice posting.
  - Inventory movement guards.
- Acceptance Criteria:
  - Return cannot exceed sold quantity per source line.
  - Return posts inventory movement and payment/refund delta consistently.
  - Tenant isolation and audit fields verified by tests.

## Slice 4 - POS Shift and Cash Drawer Controls
- Scope:
  - Introduce shift open/close lifecycle and cash drawer balancing.
- API:
  - `POST /api/pos/shifts/open`
  - `POST /api/pos/shifts/:id/close`
  - `GET /api/pos/shifts/current`
- Data:
  - Add `PosShift` and `PosShiftMovement` entities per branch/user.
- UI:
  - Shift status banner, open/close actions, close variance summary.
- Dependencies:
  - POS checkout and payments.
- Acceptance Criteria:
  - Checkout blocked if no active shift for required roles.
  - Shift close persists expected vs counted cash and variance reason.
  - Re-open requires privileged permission and leaves immutable audit entry.

## Slice 5 - Discount and Promotion Governance
- Scope:
  - Replace unrestricted manual discounts with configurable discount policies.
- API:
  - `POST /api/sales/discount-rules`
  - `GET /api/sales/discount-rules`
  - Enforce rule checks in invoice line create/update and POS checkout.
- Data:
  - `DiscountRule` with validity range, priority, eligibility filters.
- UI:
  - Rule management screen and inline line-discount validation messages.
- Dependencies:
  - Sales line pricing flow.
- Acceptance Criteria:
  - Unauthorized discount override is rejected with clear reason.
  - Rule evaluation is deterministic per tenant and time window.
  - Tests cover overlapping rules and precedence.

## Slice 6 - Sales Inventory Coupling and Cost Capture
- Scope:
  - Couple posted sales and returns to inventory movements with cost snapshots.
- API:
  - Update posting handlers; no new public endpoint mandatory.
- Data:
  - Add links from sales lines to inventory movements and cost basis snapshot field(s).
- UI:
  - Invoice detail shows stock impact status.
- Dependencies:
  - Slice 3 returns and existing inventory balance logic.
- Acceptance Criteria:
  - Posting a sale decreases stock according to stock policy.
  - Posting a return increases stock where policy allows restock.
  - Cost snapshot saved for downstream accounting (Block 5).

## Slice 7 - Sales Document Lifecycle Hardening
- Scope:
  - Add void/cancel policy with reason codes and period constraints.
- API:
  - `POST /api/sales/invoices/:id/void`
  - `POST /api/sales/returns/:id/void`
- Data:
  - lifecycle metadata: `voidedAt`, `voidedBy`, `voidReason`.
- UI:
  - Controlled void action with permission checks.
- Dependencies:
  - Slice 3 and Slice 6.
- Acceptance Criteria:
  - Only eligible statuses can be voided.
  - Void reversals preserve audit and inventory/accounting hooks.

## Slice 8 - Sales Operational Reporting (Block 4 Exit)
- Scope:
  - Sales daily summary, branch/cashier performance, return rates.
- API:
  - `GET /api/reports/sales/daily-summary`
  - `GET /api/reports/sales/by-branch`
  - `GET /api/reports/sales/returns`
- UI:
  - Sales reports page with filter and CSV export.
- Dependencies:
  - Completed Slices 3-7.
- Acceptance Criteria:
  - Report totals reconcile with sales/return documents for same filter set.
  - Tenant and branch scoping enforced.
  - Exported CSV columns and totals are deterministic and tested.

## Block 4 Exit Gate
- All slices above meet acceptance criteria.
- `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/quickgate.ps1` passes.
- `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/runpack.ps1` passes with valid `docs/_runs` evidence.
