---
name: orion-merge-safe
description: Guard ORION PR merges by requiring green checks, matching head SHA, validated run-pack evidence, no blockers, and post-merge verification plan.
---

# ORION Merge Safe

## Trigger Conditions
- User asks to merge an ORION PR.
- A PR appears ready and needs final merge governance.

## Non-Goals
- Do not implement missing features.
- Do not override failing checks.
- Do not merge without explicit merge intent.

## ORION Constraints
- Never merge unverified work.
- Confirm PR head SHA matches the reviewed commit.
- Run-pack evidence must be current and truthful.

## Required Outputs
- PR number/link, head SHA, check status, run-pack status, blockers, merge decision.
- Post-merge verification notes if merge occurs.

## PASS/PARTIAL/FAIL Rules
- PASS: checks green, SHA matches, run-pack passes, blockers empty, merge performed only after explicit request.
- PARTIAL: locally ready but external checks or permissions block merge.
- FAIL: checks fail, SHA mismatch, stale evidence, or blockers remain.

## Evidence Requirements
- GitHub check output, run-pack gate output, clean branch status.
- Merge action recorded in the run pack.

## Examples
- Use after a pushed governance PR is approved and checks are green.
- Do not use during implementation or initial checkpoint creation.
