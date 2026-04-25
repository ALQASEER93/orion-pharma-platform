# ORION Approval Governance

## Rules
- Minimize approval prompts by batching safe local work.
- Prefer Auto-review/guardian approval when available.
- Prefer session-scoped approvals when safe.
- Batch GitHub and MCP side effects near the end.
- Do not repeat PR comments.
- Do not perform GitHub side effects until local verification is complete.
- Approval requests must explain risk, command category, and why the command is needed.
- Destructive actions are denied unless explicitly justified and non-destructive alternatives were considered.
- Never use Full Access or YOLO as the default.
- Avoid network access unless a dependency or tooling check requires it and the risk is documented.
- Record every elevated action in the run pack.
- Codex performs safe commands and file changes itself; Omar should not be asked to run manual shell commands.

## Default Permission Posture
- Use workspace-write.
- Keep writable scope to the ORION repo.
- Escalate only for push, PR, network, GUI, or operations blocked by sandbox.
- If a UI trust/permission action is unavoidable, document it as `owner UI action needed` in known limitations.

## PASS/PARTIAL/FAIL
- PASS: approvals were minimal, scoped, and documented.
- PARTIAL: some approval or UI mode could not be inspected but was documented.
- FAIL: broad/destructive action occurred without explicit approval.
