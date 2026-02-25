# AP Subledger

## Lifecycle
- `POST /api/ap/bills` creates tenant-scoped `ApBill` in `OPEN` status and evaluates `AP_BILL_CREATED` posting rules.
- `POST /api/ap/payments` creates draft `ApPayment`.
- `POST /api/ap/payments/:id/apply` manages allocations against `ApBill` and updates bill balances.
- `POST /api/ap/payments/:id/post` posts payment to GL and locks payment status to `POSTED`.
- `POST /api/ap/bills/:id/void` marks bill as `VOID` with no hard delete.
- `GET /api/ap/aging?asOf=YYYY-MM-DD` returns outstanding bucketed AP aging snapshot.

## Posting Rule Event Types
- `AP_BILL_CREATED`
- `AP_PAYMENT_POSTED`

## Simulation/Post Payload Contract
- `AP_BILL_CREATED` payload fields:
  - `apBillId`
  - `billNo`
  - `supplierId`
  - `sourceType`
  - `sourceId`
  - `originalAmount`
  - `paidAmount`
  - `outstandingAmount`
- `AP_PAYMENT_POSTED` payload fields:
  - `paymentId`
  - `paymentNo`
  - `supplierId`
  - `paymentAmount`
  - `allocatedAmount`
  - `method`
  - `reference`

## Idempotency Strategy
- AP payment posting uses `PostingKey`:
  - `sourceType = AP_PAYMENT`
  - `sourceId = <apPayment.id>`
  - `stage = POST`
- The uniqueness key (`tenantId`, `sourceType`, `sourceId`, `stage`) prevents duplicate journal writes for the same payment post stage.
- If `ApPayment.status = POSTED` and `journalEntryId` is already set, posting is rejected to prevent double-posting.
- `journalEntryId` on `ApBill`/`ApPayment` links subledger rows to posted GL entries.

## Void Policy
- No deletes for AP bills or payments.
- `ApBill` can move to `VOID` only when it has no allocations and no paid amount.
- Voided bills are excluded from further allocations and aging outstanding totals.
