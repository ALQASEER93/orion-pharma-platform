---
name: orion-mcp-plugin-audit
description: Audit ORION MCP and plugin availability, trust boundaries, non-ORION paths, Browser Use, GitHub, Build Web Apps, and failure reporting.
---

# ORION MCP Plugin Audit

## Trigger Conditions
- Major run startup, tool failure, plugin install request, MCP diagnostics, or browser/GitHub evidence planning.

## Non-Goals
- Do not add marketplaces randomly.
- Do not use non-ORION filesystem MCP roots.
- Do not let plugins override ORION constraints.

## ORION Constraints
- `/mcp verbose` when available; otherwise record `codex mcp list`.
- Browser Use is mandatory for UI verification if available.
- GitHub plugin usage is batched near the end.
- Remote plugins require trust review.

## Required Outputs
- MCP/plugin status table, availability, usage decision, trust risks, failures.

## PASS/PARTIAL/FAIL Rules
- PASS: tool status and ORION-safe usage decisions are recorded.
- PARTIAL: verbose diagnostics unavailable but list/status is recorded.
- FAIL: plugin used despite non-ORION trust boundary or missing documentation.

## Evidence Requirements
- `mcp_plugin_status.md` and capability matrix JSON.

## Examples
- Use when `filesystem` MCP points outside ORION.
- Use before relying on Browser Use or GitHub plugin.
