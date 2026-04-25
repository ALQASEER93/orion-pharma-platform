---
name: orion-stage-gate
description: Decide ORION PASS/PARTIAL/FAIL only after real verification, run-pack evidence, LATEST truth, git status, and UI evidence requirements are checked.
---

# ORION Stage Gate

## Trigger Conditions
- Any final ORION verdict or stage advancement.
- Any claim that a checkpoint is complete, published, or review-ready.
- Any situation where run-pack, zip, LATEST, or clean git status must be proven.

## Non-Goals
- Do not create product features.
- Do not substitute for browser evidence, accounting integrity, or data integrity gates.
- Do not publish GitHub updates by itself.

## ORION Constraints
- ORION PHARMA only.
- No fake PASS; verification must actually run.
- UI changes require the UI evidence pack before PASS.
- Run evidence must be in `docs/_runs/run_<timestamp>/` with zip and `LATEST.txt`.

## Required Outputs
- Verdict: `PASS`, `PARTIAL`, or `FAIL`.
- What changed, what was verified, what remains open.
- Exact run folder, zip path, `LATEST.txt` value, branch, commit SHA, clean status.
- Explicit backend-only or UI statement.

## PASS/PARTIAL/FAIL Rules
- PASS: all acceptance criteria and required verification passed, zip exists, LATEST is current, git is clean or documented after commit.
- PARTIAL: useful assets exist but hooks, plugins, PR, or external checks could not be fully enabled or inspected.
- FAIL: no meaningful artifacts, skipped validation, missing run pack, or unverifiable completion.

## Evidence Requirements
- `verification.json`, `run_summary.md`, validation log, branch status, clean status proof.
- UI screenshot/browser evidence when any user-visible file changed.

## Examples
- Use before reporting a governance pass as PASS.
- Use before advancing an implementation stage.
- Do not use during initial planning.
