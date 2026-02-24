# ORION RunPack Gate

Use this skill when you need to validate merge readiness using full repository evidence.

## Goal
- Run full RunPack and confirm merge-gate status from produced artifacts.

## Steps
1. Execute:
   - `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/runpack.ps1`
2. Read latest run name:
   - `docs/_runs/LATEST.txt`
3. Validate the latest run artifacts:
   - `docs/_runs/run_<timestamp>/json/status.json`
   - `docs/_runs/run_<timestamp>.zip`
4. Enforce pass criteria:
   - `overall_pass` must be `true`
   - `blockers` must be an empty array
   - zip file must exist
   - `LATEST.txt` must match the validated run

## Output
- Report run name, zip path, `overall_pass`, and blockers.
- If any criterion fails, stop and report blockers before merge.
