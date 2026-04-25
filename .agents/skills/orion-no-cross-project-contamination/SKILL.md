---
name: orion-no-cross-project-contamination
description: Enforce strict ORION isolation by blocking non-ORION repo assumptions, paths, env vars, shared imports, MCP roots, and skill contamination.
---

# ORION No Cross-Project Contamination

## Trigger Conditions
- Any ORION task starts.
- Tooling reveals non-ORION MCP paths, skills, env vars, or imports.
- A prompt references prior non-ORION repositories or workflows.

## Non-Goals
- Do not inspect unrelated repos.
- Do not migrate assets from another project.
- Do not sanitize global config without approval.

## ORION Constraints
- Work only in `ALQASEER93/orion-pharma-platform`.
- Disable non-ORION repo-scoped skills for ORION work.
- Env vars start with `ORION_` unless documented standard third-party variables.
- Shared imports use `@orion/*`.

## Required Outputs
- Isolation decision, any contamination risk found, mitigation, and files/tools avoided.

## PASS/PARTIAL/FAIL Rules
- PASS: no non-ORION assumptions or paths are used.
- PARTIAL: non-ORION tool config exists but is avoided and documented.
- FAIL: work relies on non-ORION repo files, skills, or assumptions.

## Evidence Requirements
- `mcp_plugin_status.md` and run summary note for contamination risks.

## Examples
- Use when `codex mcp list` shows a filesystem root outside ORION.
- Use at every ORION kickoff.
