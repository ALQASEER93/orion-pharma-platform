# ORION PHARMA Repository Guidance

Keep strict ORION isolation. Do not import assumptions, workflows, or repo-scoped skills from other projects.

## Codex Runtime Policy

- Prefer GPT-5.5 with high reasoning for ORION implementation, validation, runtime governance, and durable documentation.
- If GPT-5.5 is unavailable, use GPT-5.4 and record the fallback in the run pack.
- Use mini/faster models only for bounded support work such as log or screenshot summarization.
- Use workspace-write and Auto-review/guardian approval when available.
- Do not use Full Access / YOLO unless explicitly required, justified, and documented.
- Keep Plan Mode limited to brief planning; continue execution in the same turn when appropriate.
- Omar is not expected to run shell commands, create folders, inspect logs, merge PRs, or fix files manually. Codex must perform safe repo work itself and put reviewer evidence into the run ZIP plus `docs/_runs/LATEST.txt`.
- PR #28 must remain Draft until the governance dry run and CI are clean; do not merge or mark ready from this governance cleanup stage.

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
- `orion-runtime-audit`
  - Use for Codex CLI/App, model, permission, hook, MCP, plugin, subagent, and Windows sandbox capability audits.
- `orion-approval-governance`
  - Use before elevated commands, network access, destructive operations, or GitHub side effects.
- `orion-mcp-plugin-audit`
  - Use when inspecting MCP/plugin status or deciding whether Browser Use, GitHub, or Build Web Apps plugins are safe and useful.
- `orion-no-cross-project-contamination`
  - Use whenever a tool, path, skill, env var, or MCP server could pull in non-ORION context.

## Recommended ORION Skill Order

1. Run `orion-task-brief-checklist` at kickoff.
2. Implement only the bounded slice.
3. If UI changed, run `orion-ui-evidence-pack`.
4. Run `orion-stage-gate` for verdict discipline.
5. Run `orion-pr-checkpoint` before claiming published checkpoint truth.

## Run Pack Standard

Every meaningful run must create `docs/_runs/run_<timestamp>/` with logs, artifacts, JSON, `verification.json`, `run_summary.md`, `known_limitations.md`, branch status, clean git proof, and a sibling zip archive. Update `docs/_runs/LATEST.txt` to the current run folder before claiming current evidence.

PASS requires actual verification. Use PARTIAL when useful assets are created but hook enablement, plugin inspection, push, PR, or external checks are blocked. Use FAIL when artifacts or validation are missing.

## UI Evidence Standard

Any user-visible UI change requires local preview, Browser Use/in-app browser if available, Chrome if available, walkthrough notes, screenshots, visible rejection/error state, console/network notes when available, preview URL, and UX clarity verdict. Docs/config/scripts-only work should state that no application UI files were touched.

Browser Use is required only when UI/browser evidence is relevant. Do not start browser evidence for docs-only, hooks-only, or lint-only cleanup unless a UI file is changed.

## Hooks, Agents, MCP, And Plugins

- Repo hook scripts live in `.codex/hooks/`; treat them as guardrails, not a security boundary.
- Clearly separate hooks that are actually enabled in the active Codex session from repo-local hook proposals committed for future enablement.
- Project custom agents live in `.codex/agents/`; they inherit ORION strict isolation and cannot claim PASS alone.
- Subagents must have bounded ownership and structured findings; the parent agent consolidates and decides.
- Run MCP diagnostics at major run start when available. Treat any MCP filesystem root outside this repository as unavailable for ORION.
- Browser Use is preferred for UI evidence. GitHub plugin use is batched near the end after local verification. Build Web Apps is optional and only for app-building, preview, or UI evidence value.

## Approval Governance

Minimize approval prompts, prefer Auto-review, use scoped approvals, batch side effects near the end, and document elevated actions in the run pack. Destructive actions are denied unless explicitly justified and approved. Never push to main, never force-push by default, and do not repeat PR comments.

GitHub side effects must be batched near the end after local validation. PR comments should be single, concise, and useful.

## Scope Discipline

Do not expand POS, inventory, billing, accounting, or UI scope during governance/tooling passes. Env vars must start with `ORION_` unless they are documented third-party standards. Shared imports must use `@orion/*`.
