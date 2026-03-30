# ORION Codex Skills

This index documents the repo-local ORION skills used to harden execution discipline.

## Skills

### `orion-task-brief-checklist`
- Purpose: standardize task kickoff before coding.
- Use when: starting a stage or bounded slice and the brief must be made explicit.

### `orion-stage-gate`
- Purpose: prevent fake closure and enforce PASS/PARTIAL/FAIL discipline.
- Use when: deciding or reporting whether a stage is actually closed.

### `orion-ui-evidence-pack`
- Purpose: force review-grade UI evidence for user-visible changes.
- Use when: any UI surface changed and browser proof is required.

### `orion-pr-checkpoint`
- Purpose: force truthful publication and PR checkpoint discipline.
- Use when: local work must become a pushed reviewable checkpoint.

### Existing ORION skills
- `orion-runpack-gate`: validate full run-pack merge evidence.
- `orion-merge-safe`: guarded merge flow after checks and evidence are green.

## Recommended Order

1. `orion-task-brief-checklist`
2. Implementation of the bounded slice
3. `orion-ui-evidence-pack` if UI changed
4. `orion-stage-gate`
5. `orion-pr-checkpoint`

## Notes

- These skills are workflow infrastructure only.
- They do not replace repository verification.
- They are intended to reduce vague starts, fake closure, weak UI evidence, and local-only publication claims.
