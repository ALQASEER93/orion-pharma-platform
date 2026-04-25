---
name: orion-jordan-pharmacy-domain
description: Review ORION pharmacy workflows for Jordan-first terminology, bilingual clarity, compliance assumptions, and domain correctness without expanding scope.
---

# ORION Jordan Pharmacy Domain

## Trigger Conditions
- User-visible pharmacy, admin, inventory, invoice, accounting, or POS terminology changes.
- Domain docs or workflows mention Jordan pharmacy operations.

## Non-Goals
- Do not provide legal advice.
- Do not implement new workflows unless assigned.
- Do not replace accounting or data integrity gates.

## ORION Constraints
- Primary market is pharmacies in Jordan first; warehouses later.
- Arabic and English labels must be accurate for pharmacy/admin/accounting users.
- Notifications are push/web-push first; WhatsApp later via official APIs only.

## Required Outputs
- Terminology findings, domain risks, assumptions, and recommended corrections.
- Statement of whether product behavior changed.

## PASS/PARTIAL/FAIL Rules
- PASS: terminology and workflow assumptions are accurate for the touched slice.
- PARTIAL: non-blocking domain uncertainty is documented.
- FAIL: misleading pharmacy/accounting terminology or unsupported compliance claim.

## Evidence Requirements
- File references and, for UI, screenshots showing visible text.

## Examples
- Use when editing Arabic/English POS labels.
- Use when writing Omar-facing operating guidance.
