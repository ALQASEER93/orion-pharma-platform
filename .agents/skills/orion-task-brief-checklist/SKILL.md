---
name: orion-task-brief-checklist
description: Normalize a new ORION stage or bounded slice before implementation by locking scope, constraints, validation, branch, UI status, and success bar.
---

# ORION Task Brief Checklist

## Trigger Conditions
- Start of any ORION stage, checkpoint, or bounded slice.
- Dense prompt with branch, validation, integration, or evidence requirements.
- Any task where backend-only versus UI scope changes the evidence bar.

## Non-Goals
- Do not implement features.
- Do not replace validation, stage gate, UI evidence, or PR checkpoint skills.
- Do not reopen a completed stage without a concrete contradiction.

## ORION Constraints
- ORION PHARMA only; no cross-project assumptions.
- Feature branches must be `codex/*`.
- Env vars must use `ORION_` unless they are documented third-party standards.
- Shared imports must use `@orion/*`.
- No fake PASS, no product expansion, no direct main work.

## Required Outputs
- `Scope`, `Goal`, `Constraints`, `Validation`, `GitHub`, `Env`, `Integrations`, `Output Style`.
- Stage name, branch decision, thread decision, backend-only or UI classification.
- Explicit success bar before implementation.

## PASS/PARTIAL/FAIL Rules
- PASS: brief names exact scope, non-goals, validation, evidence, branch, and output shape.
- PARTIAL: brief is usable but has documented unknowns.
- FAIL: scope, branch, or success bar is ambiguous.

## Evidence Requirements
- Record the brief in the run pack for major stages.
- Preserve branch and git status proof when the branch decision matters.

## Examples
- Use for a Codex governance pass before creating docs, skills, hooks, or agents.
- Use for a POS UI slice before opening browser evidence requirements.
- Do not use for a one-line status lookup.
