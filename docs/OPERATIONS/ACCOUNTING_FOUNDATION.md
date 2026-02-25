# Accounting Foundation

## Scope
Block 5 Slice 1 foundation introduces tenant-scoped Chart of Accounts, fiscal periods, journals, journal lines, and posting keys.

## Balancing Rule
- A journal can only be POSTED when `sum(debit) == sum(credit)`.
- Line rules:
  - no negative debit/credit
  - cannot set both debit and credit on same line
  - line must carry either debit or credit amount

## Period Locking Semantics
- Posting date resolves to a tenant period (`year`, `month`).
- `OPEN`: posting allowed.
- `CLOSED` or `LOCKED`: posting blocked.
- If period is not configured, posting is rejected.

## Posting Keys / Idempotency
- `PostingKey` uniqueness:
  - `(tenantId, sourceType, sourceId, stage)`
- Journal posting stage uses a fixed stage token (`JOURNAL_POST`).
- Repeated post requests for already posted entries are idempotent and do not duplicate state transitions.

## Dimensions Strategy
- `branchId` is a first accounting dimension on both journal header and line.
- Additional dimensions can be layered later by introducing dimension tables and line-level relation maps without changing immutable journal debit/credit rows.
