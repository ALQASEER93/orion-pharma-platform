---
name: orion-runpack-gate
description: Validate ORION run-pack completeness by checking run folder structure, verification.json, zip archive, LATEST truth, blockers, and verdict evidence.
---

# ORION Run Pack Gate

## Trigger Conditions
- Before reporting PASS/PARTIAL/FAIL for major ORION work.
- Before merge readiness checks.
- When validating `docs/_runs` evidence integrity.

## Non-Goals
- Do not invent missing verification.
- Do not replace project tests.
- Do not merge or push by itself.

## ORION Constraints
- Every meaningful run writes `docs/_runs/run_<timestamp>/`.
- Zip archive must exist beside the run folder.
- `docs/_runs/LATEST.txt` must match the current run when claiming current evidence.

## Required Outputs
- Run folder, zip path, LATEST value, verification status, blockers.
- JSON status read result when present.
- Verdict eligibility.

## PASS/PARTIAL/FAIL Rules
- PASS: folder, required files, `verification.json`, zip, and LATEST all match and blockers are empty.
- PARTIAL: evidence exists but one non-critical external capability is unavailable and documented.
- FAIL: missing run folder, missing zip, stale LATEST, or absent verification record.

## Evidence Requirements
- `json/verification.json`, validation log, known limitations, branch status, clean git proof.
- If UI was touched, screenshots must be present.

## Examples
- Use before final response for this governance pass.
- Use before guarded merge.
- Do not use as proof that tests passed unless test logs exist.
