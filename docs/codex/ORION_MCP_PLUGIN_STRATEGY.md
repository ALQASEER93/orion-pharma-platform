# ORION MCP And Plugin Strategy

## Operating Rules
- Run `/mcp verbose` at the start of major runs when available.
- If `/mcp verbose` is unavailable in shell, record `codex mcp list`.
- Record MCP server status in `tooling_versions.md`.
- Use plugins only when they directly add value.
- Do not add marketplaces or plugins randomly.
- Browser Use plugin is mandatory for UI verification if available.
- Browser Use is not required for docs-only, hooks-only, run-pack-only, or lint-only cleanup when no UI file changes.
- GitHub/PR plugin use must be batched near the end.
- Build Web Apps plugin is optional and only for app-building, preview, or UI evidence value.
- Remote plugins are allowed only after trust review and documentation.
- No plugin may override ORION constraints.
- Plugin failures must be reported honestly.

## Current ORION Trust Boundary
If an MCP filesystem server points outside the ORION repository, treat it as unavailable for ORION work. Do not use it for reads, writes, or assumptions.

## PASS/PARTIAL/FAIL
- PASS: plugin status is inspected and ORION-safe usage is documented.
- PARTIAL: verbose diagnostics are unavailable but list/status is recorded.
- FAIL: non-ORION MCP roots or untrusted plugins influence ORION work.
