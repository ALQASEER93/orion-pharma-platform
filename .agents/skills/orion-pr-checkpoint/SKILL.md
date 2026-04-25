---
name: orion-pr-checkpoint
description: Convert verified ORION local work into a truthful commit, push, and single PR update with commit SHA, run evidence, clean git proof, and no repeated comments.
---

# ORION PR Checkpoint

## Trigger Conditions
- Local ORION work must become reviewable on GitHub.
- A branch needs a commit, push, PR creation, or PR update.
- Final reporting needs committed truth versus local-only run artifacts.

## Non-Goals
- Do not run before local verification.
- Do not spam PR comments.
- Do not merge.

## ORION Constraints
- Branch must be `codex/*`; never push directly to main.
- GitHub/MCP side effects are batched near the end.
- Run evidence and `LATEST.txt` handling must be explicit.
- No unrelated local files staged.

## Required Outputs
- Branch, commit SHA, push result, PR link/number if created or updated.
- Clean git status after commit when possible.
- Run folder and zip path.
- Concise PR summary: scope, validation, risks/blockers.

## PASS/PARTIAL/FAIL Rules
- PASS: local verification passed, commit exists, push succeeded, PR state is truthful, git status is clean.
- PARTIAL: local commit/evidence complete but push or PR is blocked.
- FAIL: unverified work is pushed, unrelated files are staged, or branch/main safety is violated.

## Evidence Requirements
- `branch_status.md`, `git_status_clean.txt`, validation log, commit SHA.
- PR actions recorded in the run pack.

## Examples
- Use after this governance pass validation and zip creation.
- Use after a UI stage only after UI evidence pack is complete.
- Do not use for local-only experiments.
