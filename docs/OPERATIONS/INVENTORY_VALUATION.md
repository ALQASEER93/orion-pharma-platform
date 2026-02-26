# Inventory Valuation and COGS

## Moving Average (MVP)
- Valuation state is stored per `tenantId + branchId + productId` in `inventory_valuation_states`.
- State columns:
  - `qty_on_hand`
  - `avg_unit_cost`
  - `inventory_value`

### IN Movement
- Input:
  - `inQty` from inventory movement quantity (`> 0`)
  - `inUnitCost` from movement `unit_cost` when available, otherwise source-derived value (for GRN this is purchase line `unitPrice`)
- Update:
  - `newQty = oldQty + inQty`
  - `newValue = oldValue + (inQty * inUnitCost)`
  - `newAvg = newValue / newQty`

Example:
- Old state: `qty=10`, `value=50`, `avg=5.00`
- IN: `qty=5`, `unitCost=8`
- New state: `qty=15`, `value=90`, `avg=6.00`

### OUT Movement
- Input:
  - `outQty` from inventory movement quantity absolute value (`< 0`)
  - `unitCost` from `sales_invoice_lines.unit_cost_snapshot` when available; fallback to current moving average at posting time.
- Update:
  - `newQty = oldQty - outQty`
  - `newValue = oldValue - (outQty * unitCost)`
  - `avg` remains unchanged while `newQty > 0`
  - if `newQty == 0`, reset `avg=0`, `value=0`

## Movement Idempotency
- `inventory_valuation_applied` stores `(tenant_id, inventory_movement_id)` unique markers.
- Before valuation update, system inserts marker in the same DB transaction.
- If unique conflict occurs, movement is treated as already applied and skipped safely.

## Snapshot Behavior
- Sales posting uses line `unitCostSnapshot` when present.
- If missing at posting time, it uses current moving average and writes:
  - `unitCostSnapshot`
  - `costMethodSnapshot = MOVING_AVG`
- This keeps COGS deterministic on replay.

## COGS Posting
- Trigger points:
  - `POST /api/sales/invoices/:id/post`
  - `POST /api/sales/invoices/:id/post-cogs`
- Event type: `SALES_COGS_POSTED`
- Payload:
  - `invoiceId`, `invoiceNo`, `branchId`, `totalCogs`, `currency`
  - `lines[]` with `productId`, `qty`, `unitCostSnapshot`, `lineCogs`
- Journal creation:
  - Simulate via Posting Rules then post via journals (no hardcoded account IDs).
  - Idempotency key uses `PostingKey`:
    - `sourceType=SALES_INVOICE`
    - `sourceId=<invoiceId>`
    - `stage=COGS_POST`
- Duplicate prevention:
  - `cogs_posting_links` has unique `(tenant_id, sales_invoice_id)`.
  - Existing link means COGS is already posted.
