---
name: orion-runtime-audit
description: Audit Codex CLI/App/runtime capabilities for ORION runs, including version, model, permissions, hooks, MCP, plugins, subagents, and Windows sandbox status.
---

# ORION Runtime Audit

## Trigger Conditions
- Start of major Codex governance, tooling, or release evidence runs.
- Codex version or App behavior changes.
- Tool, sandbox, approval, MCP, or plugin behavior is unclear.

## Non-Goals
- Do not change product code.
- Do not install or upgrade tools without approval.
- Do not assume unavailable UI settings.

## ORION Constraints
- Record facts from commands or visible session context.
- Treat non-ORION MCP paths as unavailable for ORION.
- Prefer Auto-review and workspace-write; never default to Full Access.

## Required Outputs
- `tooling_versions.md` and `json/codex_capability_matrix.json`.
- Codex CLI/App version, model availability, permission mode, plugins, hooks, subagents, MCP status, OS details.

## PASS/PARTIAL/FAIL Rules
- PASS: audit records all feasible runtime facts and limitations.
- PARTIAL: some UI-only facts cannot be discovered and are documented.
- FAIL: runtime claims are made without evidence.

## Evidence Requirements
- Command outputs summarized in run-pack logs or docs.
- Version and feature sources named.

## Examples
- Use for Codex 0.125 governance acceleration.
- Use after changing Codex App/CLI versions.
