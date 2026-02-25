# AR Subledger

## Lifecycle
- `POST /api/ar/invoices/from-sales/:salesInvoiceId` creates tenant-scoped `ArInvoice` from a posted `SalesInvoice`.
- `POST /api/ar/receipts` creates a draft `ArReceipt`.
- `POST /api/ar/receipts/:id/apply` manages allocations and updates invoice balances.
- `POST /api/ar/receipts/:id/post` posts receipt to GL and locks receipt status.
- `GET /api/ar/aging?asOf=YYYY-MM-DD` returns outstanding bucketed aging snapshot.

## Posting Rule Event Types
- `AR_INVOICE_CREATED`
- `AR_RECEIPT_POSTED`

## Simulation Payload Contract
- `AR_INVOICE_CREATED` payload fields:
  - `arInvoiceId`
  - `salesInvoiceId`
  - `invoiceNo`
  - `customerId`
  - `originalAmount`
  - `paidAmount`
  - `outstandingAmount`
  - `taxTotal`
  - `discountTotal`
  - `grandTotal`
- `AR_RECEIPT_POSTED` payload fields:
  - `receiptId`
  - `receiptNo`
  - `customerId`
  - `receiptAmount`
  - `allocatedAmount`
  - `method`
  - `reference`

## Idempotency Strategy
- AR receipt posting uses `PostingKey`:
  - `sourceType = AR_RECEIPT`
  - `sourceId = <arReceipt.id>`
  - `stage = POST`
- If the same receipt is posted again after success, existing posted state is returned and no duplicate journal is created.
- `journalEntryId` on `ArInvoice`/`ArReceipt` links subledger records to posted GL entry.
