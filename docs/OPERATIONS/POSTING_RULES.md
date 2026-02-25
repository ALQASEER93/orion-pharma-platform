# Posting Rules (Block 5 / Slice 3)

## Versioning Strategy
- `PostingRuleSet` is tenant-scoped and versioned by `(tenantId, name, version)`.
- New edits are made on `DRAFT` versions only.
- `ACTIVE` rule sets are immutable in place. Any business change requires a new version.
- Activation is date-window aware using `effectiveFrom` and optional `effectiveTo`.
- Runtime resolution uses: tenant + effective date + `ACTIVE` status.

## Simulation Contract
- Endpoint: `POST /api/accounting/posting-rules/simulate`
- Input:
  - `eventType`
  - `payload`
  - `effectiveAt` (optional, defaults to now)
  - `branchId` (optional)
- Output:
  - `selectedRuleSet`
  - `matchedRules`
  - `journalPreview` (deterministic line order)
  - `totals`
  - `balanced`

## Security Notes
- Formula evaluation is implemented with a strict parser.
- Dynamic execution is prohibited: no `eval`, no `new Function`, no `vm`.
- Expressions support numeric literals, `+ - * /`, parentheses, and `min/max/round`.
- Unknown identifiers are rejected at simulation runtime.
- Disallowed fragments are blocked (`__proto__`, `prototype`, `constructor`, brackets/braces, and statement separators).
- Expression length is capped.

## Integration Path (Next Slices)
- Sales/Purchases posting flows should call simulation first, then materialize journals from preview lines.
- Journal posting idempotency remains anchored on `PostingKey` (`tenantId`, `sourceType`, `sourceId`, `stage`).
- Source handlers must avoid hardcoded account IDs and resolve accounts via posting rules (currently by account code).
