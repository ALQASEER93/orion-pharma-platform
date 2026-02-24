# Definition of Done (Operations)

## Purpose
Define the mandatory release gate from development to merge and post-merge verification for ORION Pharma.

## Mandatory Flow
1. QuickGate
2. RunPack
3. Pull Request
4. merge-safe merge
5. Post-merge RunPack

## Stage 1 - QuickGate
- Command:
  - `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/quickgate.ps1`
- Required outcome:
  - Install/lint/typecheck/tests complete with zero failures.
- Fail policy:
  - Stop; fix issues before proceeding.

## Stage 2 - RunPack
- Command:
  - `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/runpack.ps1`
- Required outcome:
  - `json/status.json` has `overall_pass=true`.
  - `json/status.json` has empty `blockers`.
  - Evidence generated only under `docs/_runs`.
  - 3-ZIP policy satisfied:
    - `docs/_runs/run_<ts>.zip`
    - `docs/_runs/run_<ts>_logs.zip`
    - `docs/_runs/run_<ts>_advisor.zip`
  - `docs/_runs/LATEST.txt` points to validated `run_<ts>`.
- Fail policy:
  - Stop; do not open/merge PR until RunPack is green.

## Stage 3 - Pull Request to `main`
- Required:
  - Work must be on feature branch `codex/*`.
  - PR includes clear summary + acceptance criteria + evidence paths (repo-relative POSIX paths only).
  - No manual owner actions; use `gh`/MCP/apps workflow only.
- Evidence comment format (example):
  - `docs/_runs/run_<ts>/`
  - `docs/_runs/run_<ts>.zip`
  - `docs/_runs/run_<ts>_logs.zip`
  - `docs/_runs/run_<ts>_advisor.zip`
  - `docs/_runs/LATEST.txt`

## Stage 4 - merge-safe Merge
- Preconditions:
  - Required checks green on PR head.
  - Merge operation must match head commit (no stale merge).
  - Local RunPack gate already confirmed.
- Fail policy:
  - If head changes or checks regress, rerun gate from Stage 1.

## Stage 5 - Post-merge RunPack on `main`
- Required:
  - Checkout `main` at merged commit.
  - Run full RunPack again.
  - Confirm `overall_pass=true`, no blockers, valid 3-ZIP artifacts, and updated `LATEST.txt`.
- Completion criteria:
  - Only after post-merge RunPack passes is the delivery fully done.

## Cross-Cutting Constraints
- Environment variables must use `ORION_` prefix.
- Shared imports and reusable packages must follow `@orion/*`.
- Evidence governance is restricted to `docs/_runs` only.
- Legacy `docs_runs` path is disallowed.
