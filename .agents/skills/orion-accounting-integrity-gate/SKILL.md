---
name: orion-accounting-integrity-gate
description: Gate ORION accounting or ledger changes by requiring balanced entries, tenant isolation, invariant tests, and no premature accounting feature expansion.
---

# ORION Accounting Integrity Gate

## Trigger Conditions
- Accounting, ledger, invoice posting, journal, fiscal period, tax, or payment allocation files are touched.
- A change may affect future full in-app accounting correctness.

## Non-Goals
- Do not implement new accounting features in governance passes.
- Do not approve ledger behavior without tests.
- Do not substitute terminology review for invariant proof.

## ORION Constraints
- Full accounting remains roadmap-critical but must be implemented only in assigned stages.
- Jordan pharmacy terminology must be precise in Arabic and English.
- Tenant and fiscal boundaries must be preserved.

## Required Outputs
- Accounting files touched, invariants checked, tests run, risks/blockers.
- Explicit statement if accounting was not touched.

## PASS/PARTIAL/FAIL Rules
- PASS: balanced debit/credit invariants and relevant tests pass.
- PARTIAL: no accounting files touched, or evidence gap is documented for advisory review.
- FAIL: ledger imbalance risk, untested posting changes, or hidden accounting expansion.

## Evidence Requirements
- Focused tests for ledger/accounting changes.
- Run-pack notes naming invariant checks.

## Examples
- Use for ledger service changes.
- Use as "not applicable" proof for this governance pass.
