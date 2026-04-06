---
name: orion-task-brief-checklist
description: Standardize ORION task kickoff before any implementation. Use when starting a new ORION stage or bounded slice and you need to force an explicit brief covering scope, goal, constraints, validation, GitHub path, environment, integrations, output style, branch/window decision, backend-only vs UI declaration, and success bar before coding.
---

# ORION Task Brief Checklist

## Title
- Build the task brief before coding.

## When to use
- Use at the start of any new ORION stage or sub-slice.
- Use when the user gives dense constraints that must be normalized into a concrete execution brief.
- Use when branch/window continuity matters.

## When NOT to use
- Do not use after implementation is already underway and the kickoff brief is already explicit.
- Do not use for pure post-run reporting where the execution path is already fixed.
- Do not use as a substitute for verification or stage closure.

## Required inputs
- Stage name or bounded slice name.
- Branch context: same branch or new branch.
- Thread context: same window/thread or new one.
- Scope boundaries.
- Goal.
- Constraints and explicit non-goals.
- Validation requirements.
- GitHub context if relevant.
- Environment assumptions and blockers.
- Integration boundaries.
- Required final response shape.

## Exact output contract
- Emit a kickoff brief with these headings in this order:
  1. `Scope`
  2. `Goal`
  3. `Constraints`
  4. `Validation`
  5. `GitHub`
  6. `Env`
  7. `Integrations`
  8. `Output Style`
- State the exact stage name.
- State `same branch` or `new branch`.
- State `same window/thread` or `new window/thread`.
- State `backend-only` or `UI slice`.
- State the success bar before coding starts.

## Failure conditions / stop conditions
- Stop if the stage name is missing and cannot be inferred safely.
- Stop if branch continuity is ambiguous and the task depends on existing local state.
- Stop if the user is asking for execution but the success bar is still undefined.
- Reject vague starts such as “continue” or “fix it” without reconstructing the brief.

## ORION-specific rules
- Keep strict ORION isolation.
- Do not reopen a previously accepted stage unless a real contradiction is found.
- Do not let “continue from latest state” bypass explicit scope and success criteria.
- Call out whether the slice touches UI, because that changes evidence requirements.

## Backend-only example
- Example kickoff:
  - `Scope`: Stage 8.xx backend-only acceptance closeout for inventory ledger service guards.
  - `Goal`: Close missing test and migration proof gaps only.
  - `Constraints`: No UI, no new workflows, same branch, same thread.
  - `Validation`: API typecheck, focused specs, migration verification.
  - `GitHub`: update existing PR only if commit is pushed.
  - `Env`: local DB caveat must be logged if present.
  - `Integrations`: no JoFotara, no accounting expansion.
  - `Output Style`: PASS/PARTIAL/FAIL with run folder and zip.

## UI-slice example
- Example kickoff:
  - `Scope`: POS thin UI acceptance closeout only.
  - `Goal`: fix lock-state clarity and evidence naming.
  - `Constraints`: same branch, same thread, no domain redesign.
  - `Validation`: web typecheck/test/build, API smoke, local preview, Chrome if available, screenshots, walkthrough.
  - `GitHub`: push checkpoint and update active PR.
  - `Env`: note preview URL and auth/demo context.
  - `Integrations`: real backend only, no mock path.
  - `Output Style`: verdict plus exact preview URL, run folder, zip, PR impact.

## Anti-patterns / forbidden shortcuts
- Do not start coding before declaring the success bar.
- Do not treat “same branch” as implied.
- Do not omit backend-only vs UI classification.
- Do not collapse validation into a generic “run tests”.
- Do not accept hand-wavy goals such as “finish the stage”.
