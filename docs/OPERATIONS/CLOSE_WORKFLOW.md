# Close Workflow (Block 5 / Slice 7)

## Scope
- Endpoints:
  - `POST /api/accounting/periods/:id/close`
  - `POST /api/accounting/periods/:id/reopen`
  - `GET /api/accounting/trial-balance?periodId=...`
  - `GET /api/accounting/statements/pl?periodId=...`
  - `GET /api/accounting/statements/bs?periodId=...`
- Data source: `POSTED` journals only.
- Tenant boundary: strict `tenantId` filtering for all close/snapshot operations.

## Close Rules
- Period must exist in tenant and be `OPEN`.
- Close is blocked if any `DRAFT` journals exist in the same period window.
- Journal balance check is mandatory:
  - `sum(debit) == sum(credit)` from posted period journals.
- Successful close:
  - sets period status to `CLOSED`
  - creates `period_closes` revision row (`status=CLOSED`)
  - creates immutable snapshots:
    - `trial_balance_snapshots`
    - `statement_snapshots` (`PL`, `BS`)
  - writes audit log action `PERIOD_CLOSE`

## Statement Mapping (Minimal)
- `PL` includes account types:
  - `REV` as revenue
  - `EXP` as expenses
- `BS` includes account types:
  - `ASSET`, `LIAB`, `EQUITY`
- Current-period retained earnings:
  - computed as period `netIncome = revenue - expenses`
  - added as synthetic equity line in balance sheet payload
  - original account balances remain unchanged (no mutation of chart accounts)

## Reopen Policy (Audit Safe)
- Reopen is role-gated via accounting manage permission.
- Allowed states for reopen: `CLOSED` or `LOCKED`.
- Reopen action:
  - sets period status back to `OPEN`
  - creates `period_closes` revision row (`status=REOPENED`)
  - writes audit log action `PERIOD_REOPEN`
- Snapshots are immutable:
  - no delete on prior snapshots
  - no overwrite of existing snapshot rows
  - each close/reopen cycle is a new revision event

## Posting Guard in Closed/Locked Periods
- Posting into `CLOSED` or `LOCKED` periods is rejected in journal posting flow.
- Applies to direct journal posting and domain posting paths that call journal-posting runtime.

## Operational Expectation
- Close should be run after operational posting is complete for the period.
- If corrections are required:
  - reopen with auditable reason
  - apply corrected entries
  - close again to generate a new immutable snapshot revision set
