---
name: orion-pr-checkpoint
description: Enforce publishable ORION checkpoint discipline on the active branch and PR. Use when converting local work into a reviewable checkpoint and you must prove clean git status, commit SHA, push confirmation, PR impact, concise PR comment/update summary, committed truth versus local-only run artifacts, and correct handling of docs/_runs/LATEST.txt.
---

# ORION PR Checkpoint

## Title
- Publish the checkpoint truthfully.

## When to use
- Use when local ORION work must become a reviewable checkpoint.
- Use before telling the user a stage is published or reviewable.
- Use when PR #, commit SHA, and run-artifact boundaries must be made explicit.

## When NOT to use
- Do not use for purely local experimentation that is intentionally not being published.
- Do not use after merge when the task is already about post-merge verification.
- Do not use instead of the stage gate verdict.

## Required inputs
- Active branch name.
- Intended publishable file set.
- Commit message plan.
- PR number or whether no PR exists.
- Current `docs/_runs/LATEST.txt` handling.
- Run folder and zip path if evidence was generated.

## Exact output contract
- Confirm clean git status before close.
- Report explicit commit SHA.
- Confirm push result.
- Report PR number and impact.
- Provide a concise PR comment/update summary.
- Distinguish committed truth from local-only run artifacts.
- State how `docs/_runs/LATEST.txt` was handled.
- Refuse acceptance if the code is still local-only.

## Failure conditions / stop conditions
- Stop if unrelated residue is staged.
- Stop if push fails and no remote checkpoint exists.
- Stop if PR impact cannot be described truthfully.
- Stop if `LATEST.txt` is stale for a stage whose governance depends on it.

## ORION-specific rules
- Same branch continuity matters when a stage explicitly says to remain on the current branch.
- Run directories and zip files may be local-only even when `LATEST.txt` is tracked; call that split out explicitly.
- Never treat a local commit as published truth until the remote branch matches it.

## Backend-only example
- Service checkpoint:
  - Commit backend files only
  - Push branch
  - Comment on active PR with SHA, verification set, and local-only run artifact path

## UI-slice example
- POS thin UI checkpoint:
  - Publish UI/API diff
  - Push branch
  - Comment on PR with preview URL, screenshot path, and exact rejection path captured

## Anti-patterns / forbidden shortcuts
- Do not say “updated on GitHub” without verifying remote HEAD.
- Do not include ignored run-pack folders just to make the repo look complete.
- Do not leave `LATEST.txt` ambiguous when it is part of tracked repo truth.
- Do not close the checkpoint while `git status` is dirty.
