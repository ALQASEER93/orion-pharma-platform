---
name: orion-data-integrity-gate
description: Check ORION schema, migration, Prisma, seed, import/export, and tenant data changes for tests, reversibility, and evidence before acceptance.
---

# ORION Data Integrity Gate

## Trigger Conditions
- Prisma schema, migrations, seeds, DTO validation, import/export, or persistence behavior changes.
- Data deletion, migration history, or lockfile changes are proposed.

## Non-Goals
- Do not create destructive migrations without explicit approval.
- Do not replace accounting-specific invariant checks.
- Do not approve data changes with docs-only evidence.

## ORION Constraints
- Multi-tenant SaaS-first architecture.
- No deleting migration history.
- Lockfile deletion requires documented reason and approval.

## Required Outputs
- Data surface touched, migration/test commands, rollback notes, blockers.
- Explicit statement when no data files were touched.

## PASS/PARTIAL/FAIL Rules
- PASS: relevant data tests and migration verification pass.
- PARTIAL: no data files touched or external DB unavailable with documented limits.
- FAIL: schema/model changes without tests or migration proof.

## Evidence Requirements
- Logs for migration/test commands.
- Run-pack known limitations for unavailable DB/tooling.

## Examples
- Use for Prisma model changes.
- Use as "not applicable" proof for docs-only governance work.
