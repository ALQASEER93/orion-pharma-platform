---
name: orion-approval-governance
description: Govern ORION approvals by minimizing prompts, preferring Auto-review and scoped approvals, documenting elevated actions, and denying destructive defaults.
---

# ORION Approval Governance

## Trigger Conditions
- Commands need escalation, network, destructive action, GitHub side effect, or broad filesystem access.
- A stage requires approval policy documentation.

## Non-Goals
- Do not bypass approvals.
- Do not use Full Access or YOLO by default.
- Do not approve destructive actions without explicit justification.

## ORION Constraints
- Auto-review is preferred when available.
- Batch GitHub side effects near the end.
- Network access is avoided unless needed and documented.
- Every elevated action is recorded in the run pack.

## Required Outputs
- Approval mode, elevated actions, risk category, reason, result, and safer alternatives considered.

## PASS/PARTIAL/FAIL Rules
- PASS: approvals are scoped, justified, and recorded.
- PARTIAL: approval status partly UI-only but limitation is documented.
- FAIL: broad/destructive action occurs without approval or evidence.

## Evidence Requirements
- `approval_governance_status.md`.
- Command/result notes for elevated actions.

## Examples
- Use before `git push` or network dependency checks.
- Use when documenting why hooks were not globally installed.
