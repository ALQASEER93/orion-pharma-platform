---
name: orion-stage-gate
description: Enforce ORION stage closure discipline and prevent fake completion. Use when deciding or reporting whether an ORION stage or checkpoint is PASS, PARTIAL, or FAIL, and when you must separate what changed, what was verified, what remains open, exact run folder, exact zip path, LATEST.txt truth, PR impact, and backend-only status.
---

# ORION Stage Gate

## Title
- Gate the stage verdict after verification.

## When to use
- Use before any ORION acceptance claim.
- Use when preparing a final response for a bounded stage or checkpoint.
- Use when review feedback questions whether closure was truly earned.

## When NOT to use
- Do not use for early planning before implementation exists.
- Do not use as a replacement for UI evidence capture or PR publication steps.
- Do not use to justify advancing to the next stage while the current one is still open.

## Required inputs
- Stage name.
- Actual implementation delta.
- Actual verification results.
- Current run folder and zip path.
- Current `docs/_runs/LATEST.txt` truth.
- PR/branch status if GitHub is in play.
- Slice classification: backend-only or UI.

## Exact output contract
- Verdict must be one of `PASS`, `PARTIAL`, or `FAIL`.
- Progress percentage changes only when materially earned.
- Final response must separate:
  1. what changed
  2. what was verified
  3. what remains open
  4. exact run folder
  5. exact zip path
  6. `LATEST.txt` truth
  7. PR impact
- Explicitly state if the slice was backend-only.

## Failure conditions / stop conditions
- Stop and refuse PASS if verification did not actually run.
- Stop and refuse PASS if code is still local-only when the stage requires publication.
- Stop and refuse PASS if run folder or zip path cannot be named exactly.
- Stop and mark PARTIAL or FAIL if `LATEST.txt` truth is stale for the accepted checkpoint.

## ORION-specific rules
- No stage advancement before current stage is truly closed.
- Reject “done”, “closed”, or “complete” language without evidence.
- Distinguish accepted product truth from local-only evidence truth.
- If UI changed, require the UI evidence pack before allowing PASS.

## Backend-only example
- Backend acceptance closeout:
  - `PASS` only after service tests, migration proof, run pack, commit SHA, and clean git status are all real.

## UI-slice example
- POS UI checkpoint:
  - `PARTIAL` if screenshots exist but finalized controls still look active/confusing.

## Anti-patterns / forbidden shortcuts
- Do not say “looks good” instead of PASS/PARTIAL/FAIL.
- Do not inflate progress percentage without a published checkpoint or real verification.
- Do not bury open blockers under change summaries.
- Do not skip `LATEST.txt` truth in final reporting.
