---
name: orion-codex-update-watch
description: Track Codex CLI/App changes that affect ORION governance, evidence, approvals, hooks, plugins, models, and Windows runtime behavior.
---

# ORION Codex Update Watch

## Trigger Conditions
- Codex CLI/App version changes.
- A major ORION stage starts after a Codex release.
- Omar asks whether to upgrade or change runtime settings.

## Non-Goals
- Do not install unstable releases by default.
- Do not claim latest status without verification.
- Do not replace release validation.

## ORION Constraints
- Prefer stable Codex releases for production ORION work.
- Use GPT-5.5 when available; GPT-5.4 fallback must be recorded.
- Update impact must be translated into ORION policies, not generic notes.

## Required Outputs
- Version observed, release impact, ORION benefit, risk, when not to rely on it, UI action needed.

## PASS/PARTIAL/FAIL Rules
- PASS: release impact is current enough and sourced or locally verified.
- PARTIAL: some release details depend on external docs and are marked.
- FAIL: update claims are unsourced or contradicted by local CLI.

## Evidence Requirements
- `CODEX_0118_TO_0125_ORION_IMPACT.md` or successor impact note.
- Runtime audit run pack.

## Examples
- Use for Codex 0.118.0 to 0.125.0 governance mapping.
