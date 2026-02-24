---
name: orion-merge-safe
description: Guarded PR merge workflow requiring green checks, head SHA match, and post-merge RunPack verification.
---

# ORION Merge Safe

Use this skill when a PR is ready and you need a guarded merge with post-merge verification.

## Goal
- Merge only when required checks and local evidence pass.

## Pre-merge requirements
1. Confirm PR mergeability is clean.
2. Confirm required checks are `SUCCESS` for the exact head commit.
3. Confirm local RunPack gate is passing (`overall_pass=true`, `blockers=[]`).

## Merge command
- Use guarded merge with exact commit match:
  - `gh pr merge <PR_NUMBER> --merge --delete-branch --match-head-commit <HEAD_SHA>`

## Post-merge verification
1. Checkout main and sync:
   - `git checkout main`
   - `git pull --ff-only`
2. Run RunPack again:
   - `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/runpack.ps1`
3. Validate latest post-merge run:
   - `docs/_runs/LATEST.txt`
   - `docs/_runs/run_<timestamp>/json/status.json`
   - `docs/_runs/run_<timestamp>.zip`

## Output
- Merge commit SHA
- Post-merge run name and zip path
- `overall_pass` and blockers
