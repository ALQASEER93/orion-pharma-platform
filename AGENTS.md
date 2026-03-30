# ORION PHARMA Repository Guidance

Keep strict ORION isolation. Do not import assumptions, workflows, or repo-scoped skills from other projects.

## Local Skills

Use repo-local skills from `.agents/skills` when the task matches:

- `orion-task-brief-checklist`
  - Use at stage kickoff to normalize scope, goal, constraints, validation, GitHub path, environment, integrations, output style, branch/window continuity, slice type, and success bar.
- `orion-stage-gate`
  - Use before any PASS/PARTIAL/FAIL verdict or stage advancement.
- `orion-ui-evidence-pack`
  - Use whenever any user-visible ORION surface changes and browser-proof is required.
- `orion-pr-checkpoint`
  - Use when local work must become a truthful pushed checkpoint on the active branch or PR.
- `orion-runpack-gate`
  - Use when validating full repository run-pack evidence before merge.
- `orion-merge-safe`
  - Use for guarded PR merge flow after checks and run-pack truth are green.

## Recommended ORION Skill Order

1. Run `orion-task-brief-checklist` at kickoff.
2. Implement only the bounded slice.
3. If UI changed, run `orion-ui-evidence-pack`.
4. Run `orion-stage-gate` for verdict discipline.
5. Run `orion-pr-checkpoint` before claiming published checkpoint truth.
