---
name: orion-release-evidence-pack
description: Assemble ORION release evidence with run summary, validation logs, zip, LATEST, clean git proof, PR impact, and honest limitations.
---

# ORION Release Evidence Pack

## Trigger Conditions
- Preparing a reviewable checkpoint, release candidate, or governance pass closeout.
- External review needs exact artifacts.

## Non-Goals
- Do not replace implementation validation.
- Do not hide blockers.
- Do not create repeated PR comments.

## ORION Constraints
- Every meaningful run gets a run folder and zip.
- PASS requires actual verification.
- GitHub side effects happen near the end.

## Required Outputs
- Run summary, validation log, known limitations, branch status, verification JSON, zip.
- Commit SHA and PR link if published.

## PASS/PARTIAL/FAIL Rules
- PASS: evidence complete and verification passed.
- PARTIAL: evidence complete but push/PR or tool enablement blocked.
- FAIL: evidence missing or validation skipped.

## Evidence Requirements
- `docs/_runs/run_<timestamp>/` plus `docs/_runs/run_<timestamp>.zip`.
- `docs/_runs/LATEST.txt` updated.

## Examples
- Use before final response on this governance pass.
- Use before external advisor review.
