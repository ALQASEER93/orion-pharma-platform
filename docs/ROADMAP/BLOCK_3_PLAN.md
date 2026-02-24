# Block 3 Plan - Procurement and Supplier Flows

## Slice 1 - Suppliers Core
- Scope: supplier schema, API CRUD, tests, and minimal web list/create/edit screen.
- Endpoints:
  - `GET /api/suppliers`
  - `POST /api/suppliers`
  - `PATCH /api/suppliers/:id`
- Schema:
  - Add `Supplier` model with `tenantId` isolation, unique `(tenantId, code)`, and searchable names.
- UI:
  - Add `/suppliers` page for tenant-scoped list/create/edit.
- Tests:
  - API e2e for list/create/update/conflict and tenant isolation.
- Gates:
  - QuickGate pass.
  - RunPack pass before merge.
- Acceptance Criteria:
  - Supplier CRUD works per tenant and does not leak cross-tenant data.
  - Duplicate supplier code in same tenant returns conflict.
  - Required checks and local RunPack are green.

## Slice 2 - Purchase Orders Core
- Scope: PO header/line schema and API create/list/detail.
- Endpoints:
  - `GET /api/purchase-orders`
  - `POST /api/purchase-orders`
  - `GET /api/purchase-orders/:id`
- Schema:
  - `PurchaseOrder` and `PurchaseOrderLine` linked to `Supplier`, `Product`, `Tenant`.
- UI:
  - PO list + create draft.
- Tests:
  - API e2e for draft creation, totals, tenant isolation.
- Gates:
  - QuickGate and RunPack.
- Acceptance Criteria:
  - PO creation validates supplier/product ownership by tenant.
  - Immutable PO number format generated per tenant.

## Slice 3 - Goods Receipt (GRN) to Inventory
- Scope: receive PO lines and update stock with atomic balance guards.
- Endpoints:
  - `POST /api/goods-receipts`
  - `GET /api/goods-receipts`
- Schema:
  - GRN header/line linked to PO and inventory movement references.
- UI:
  - GRN create against open PO lines.
- Tests:
  - Concurrent receipt tests and stock update correctness.
- Gates:
  - QuickGate and RunPack.
- Acceptance Criteria:
  - Inventory updates are transactional and preserve non-negative guard behavior from Block 2.
  - Tenant and branch boundaries are strictly enforced.

## Slice 4 - Purchase Returns and Adjustments
- Scope: return to supplier and procurement-specific stock adjustments.
- Endpoints:
  - `POST /api/purchase-returns`
  - `POST /api/procurement-adjustments`
- Schema:
  - Return and adjustment documents with reason codes and audit links.
- UI:
  - Return/adjustment form and history.
- Tests:
  - Permission checks and inventory impact assertions.
- Gates:
  - QuickGate and RunPack.
- Acceptance Criteria:
  - Returns/adjustments produce auditable inventory movements.
  - Unauthorized roles cannot post returns/adjustments.

## Slice 5 - Procurement Reports and Export
- Scope: supplier spend, open PO, receipt variance reporting, CSV export.
- Endpoints:
  - `GET /api/reports/procurement/supplier-spend`
  - `GET /api/reports/procurement/open-pos`
- Schema:
  - No required new core tables; use read models/queries.
- UI:
  - Reporting page with filters and export actions.
- Tests:
  - Query correctness tests and export smoke tests.
- Gates:
  - QuickGate and RunPack.
- Acceptance Criteria:
  - Reports are tenant-scoped, filterable, and exportable.
  - Response time remains acceptable on seeded dataset.
