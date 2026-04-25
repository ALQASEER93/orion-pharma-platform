---
name: orion-run-pack-zipper
description: Create and verify ORION run-pack zip archives with required folder structure, verification JSON, LATEST update, and exact path reporting.
---

# ORION Run Pack Zipper

## Trigger Conditions
- A meaningful ORION run needs a final evidence archive.
- `docs/_runs/LATEST.txt` must point to the current run.

## Non-Goals
- Do not fabricate logs.
- Do not include unrelated large caches or non-ORION files.
- Do not replace validation.

## ORION Constraints
- Required folder: `docs/_runs/run_<timestamp>/`.
- Zip path: `docs/_runs/run_<timestamp>.zip`.
- LATEST must match the archived run.

## Required Outputs
- Zip creation command/result, zip path, LATEST value, required-file checklist.

## PASS/PARTIAL/FAIL Rules
- PASS: zip exists, required files exist, LATEST matches, archive can be listed.
- PARTIAL: zip exists but optional evidence unavailable and documented.
- FAIL: no zip, stale LATEST, or missing verification JSON.

## Evidence Requirements
- `hooks_status.md`, `validation_log.md`, `json/verification.json`, `run_summary.md`, `known_limitations.md`.

## Examples
- Use at the end of this governance pass.
- Use before PR publication for major stages.
