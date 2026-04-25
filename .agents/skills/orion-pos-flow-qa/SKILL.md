---
name: orion-pos-flow-qa
description: Verify ORION POS flows with bounded cashier workflows, tenant safety, rejection states, browser evidence, and no unrelated POS feature expansion.
---

# ORION POS Flow QA

## Trigger Conditions
- POS checkout, cart, payment, receipt, stock, or cashier UI/API behavior is touched.
- A reviewer asks for POS workflow proof.

## Non-Goals
- Do not implement new POS scope.
- Do not redesign UI unless assigned.
- Do not bypass real backend contracts.

## ORION Constraints
- Jordan pharmacy first; bilingual operator terminology must be accurate.
- Preserve tenant isolation and inventory integrity.
- Push/web-push notification roadmap only; no WhatsApp implementation.

## Required Outputs
- Flow matrix, pass/fail notes, rejection states, browser screenshots when UI changed.
- Tests or manual walkthrough evidence.

## PASS/PARTIAL/FAIL Rules
- PASS: core happy path, rejection path, locked/final state, and validation all pass.
- PARTIAL: non-blocking evidence gap is documented.
- FAIL: cashier can complete invalid sale, mutate final sale, or evidence is missing.

## Evidence Requirements
- UI evidence pack for visible POS changes.
- Test logs for API/data changes.

## Examples
- Use when a POS route or sale service changes.
- Do not use for docs-only governance work.
