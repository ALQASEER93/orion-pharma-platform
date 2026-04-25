# Codex 0.118.0 To 0.125.0 ORION Impact Map

Last local audit: 2026-04-25. Scope: ORION PHARMA only.

Use this map to translate Codex CLI/App changes into ORION workflow rules. It does not authorize product feature work.

## Baseline Policy

- Preferred model: GPT-5.5 for implementation, refactor, debug, testing, validation, and durable knowledge artifacts.
- Fallback: GPT-5.4 when GPT-5.5 is unavailable; record the fallback in `verification.json`.
- Mini/faster models: only for bounded support work such as log or screenshot summarization when available.
- Permission mode: workspace-write with Auto-review/guardian approval when available.
- Do not use Full Access or YOLO unless explicitly required and documented.
- Browser Use is required for UI evidence when available.
- GitHub/plugin side effects happen near the end after local verification.

## 0.118.0

### Windows sandbox proxy-only networking
- ORION benefit: safer Windows execution with less accidental network exposure.
- How to use it: keep network off unless a dependency/tooling check requires it.
- Risk/limitation: proxy-only behavior can make package or MCP checks fail.
- When not to rely on it: do not treat sandbox networking as a security boundary.
- User UI action: may require approval if network is needed.

### Device-code sign-in flow
- ORION benefit: easier CLI auth without browser credential leakage into prompts.
- How to use it: use official Codex login flow only.
- Risk/limitation: UI-only state may not be visible to agents.
- When not to rely on it: do not assume login status without checking.
- User UI action: yes, when reauth is required.

### Prompt and stdin exec workflow
- ORION benefit: supports repeatable audits and future run-pack automation.
- How to use it: prefer explicit prompts and JSON/log output for automation.
- Risk/limitation: noninteractive runs still need scoped permissions.
- When not to rely on it: do not use for unbounded product work without review.
- User UI action: no, unless approvals are needed.

### Short-lived bearer tokens and token refresh
- ORION benefit: reduces long-lived credential exposure.
- How to use it: let Codex manage tokens; do not write secrets into repo files.
- Risk/limitation: expiry can interrupt long runs.
- When not to rely on it: do not assume remote/GitHub actions succeeded after auth errors.
- User UI action: sometimes for reauth.

### `.codex` file protection
- ORION benefit: protects runtime governance files from accidental tampering.
- How to use it: keep project-scoped hooks, agents, and snippets under `.codex/`.
- Risk/limitation: protection depends on active CLI/App support.
- When not to rely on it: use code review and git history for real assurance.
- User UI action: no.

### MCP startup robustness
- ORION benefit: fewer false tool failures.
- How to use it: inspect MCP status at major run start.
- Risk/limitation: configured servers can still point outside ORION.
- When not to rely on it: do not use non-ORION MCP roots.
- User UI action: no, unless auth/setup is needed.

### Windows apply_patch reliability
- ORION benefit: safer repo edits from Windows paths.
- How to use it: prefer `apply_patch` for manual edits.
- Risk/limitation: large generated artifacts still need validation.
- When not to rely on it: do not skip git diff review.
- User UI action: no.

## 0.119.0

### Richer MCP Apps and custom servers
- Benefit: more tool options for browser, GitHub, docs, and diagnostics.
- Use: choose tools only when they add direct value.
- Do not use: non-ORION filesystem roots or untrusted remote servers.
- Risk: plugin/MCP trust boundaries can bypass project assumptions.
- UI action: sometimes for auth/install.

### Resource reads
- Benefit: structured context can reduce shell probing.
- Use: prefer repo-local resources when safe.
- Do not use: resources from unrelated repositories.
- Risk: stale resources can mislead.
- UI action: no.

### Tool-call metadata
- Benefit: better evidence in run packs.
- Use: record command/tool status and failures.
- Do not use: as a substitute for actual logs.
- Risk: metadata may omit domain-level failures.
- UI action: no.

### Remote/app-server workflows
- Benefit: improves long-running ORION sessions and desktop integration.
- Use: for controlled remote sessions with matching permission profiles.
- Do not use: when environment provenance is unclear.
- Risk: remote state can drift from local repo.
- UI action: sometimes.

### `/resume` by ID/name
- Benefit: safer continuation of long ORION tasks.
- Use: resume same branch/task; fork alternatives.
- Do not use: to carry unverified assumptions across stages.
- Risk: stale context.
- UI action: no.

### Faster MCP status
- Benefit: quicker startup diagnostics.
- Use: check MCP before major runs.
- Do not use: as proof a tool is safe for ORION.
- Risk: enabled does not mean trusted.
- UI action: no.

## 0.120.0

### Background agent progress streaming
- Benefit: better visibility into long checks.
- Use: bounded subagents for sidecar verification only.
- Do not use: unnecessary fan-out.
- Risk: token cost and split responsibility.
- UI action: no.

### Hook activity visibility
- Benefit: shows governance guardrail behavior.
- Use: document hook warnings in run packs.
- Do not use: as a hard security boundary.
- Risk: hooks may be advisory or not globally enabled.
- UI action: maybe.

### MCP outputSchema typing
- Benefit: more reliable structured tool outputs.
- Use: prefer typed outputs for evidence.
- Do not use: to skip human review of critical results.
- Risk: schema mismatch or partial output.
- UI action: no.

### SessionStart hook source detection
- Benefit: better run provenance.
- Use: record session source when discoverable.
- Do not use: when unavailable in the current app.
- Risk: incomplete UI visibility.
- UI action: no.

## 0.121.0

### `codex marketplace add`
- Benefit: controlled plugin expansion.
- Use: only after trust review.
- Do not use: random marketplace discovery.
- Risk: supply-chain and scope drift.
- UI action: likely.

### History Ctrl+R
- Benefit: faster reuse of vetted ORION prompts.
- Use: recall prompts, then re-check repo state.
- Do not use: to bypass current status inspection.
- Risk: stale command reuse.
- UI action: yes, interactive.

### Memory controls
- Benefit: reduce stale cross-stage assumptions.
- Use: clear/reset when switching stages if needed.
- Do not use: to store secrets.
- Risk: UI-only settings may not be visible in run pack.
- UI action: yes.

### MCP Apps tool calls
- Benefit: richer GitHub/browser/docs flows.
- Use: task-specific only.
- Do not use: non-ORION roots or premature GitHub side effects.
- Risk: external state changes.
- UI action: sometimes.

### Parallel-call opt-in
- Benefit: faster inspection and validation.
- Use: parallelize independent reads/checks.
- Do not use: overlapping writes.
- Risk: noisy or conflicting side effects.
- UI action: no.

### Secure devcontainer profile
- Benefit: future isolated environments.
- Use: for reproducible ORION validation when adopted.
- Do not use: if it hides Windows-specific issues.
- Risk: local/devcontainer drift.
- UI action: maybe.

## Codex App 26.415 And April App Updates

### In-app browser / Browser Use
- Benefit: mandatory UI evidence path when available.
- Use: preview routes, inspect states, capture screenshots.
- Do not use: as replacement for functional tests.
- Risk: browser state/auth can differ from reviewer environment.
- UI action: yes.

### Task sidebar and PR workflow
- Benefit: better supervisor review and checkpoint visibility.
- Use: batch PR updates near the end.
- Do not use: repeated comments or unverified PR claims.
- Risk: external side effects.
- UI action: yes.

### Artifact viewer
- Benefit: easier screenshot/doc/run-pack review.
- Use: inspect evidence before verdict.
- Do not use: if artifact did not actually render.
- Risk: display success is not test success.
- UI action: yes.

### Multiple terminals
- Benefit: separate app, test, and log sessions.
- Use: keep terminal purpose named.
- Do not use: hidden uncontrolled long-running processes.
- Risk: stale servers and port confusion.
- UI action: yes.

### Plugins and improved thread/tool rendering
- Benefit: clearer diagnostics and capability use.
- Use: record detected plugins in capability matrix.
- Do not use: plugin-driven scope expansion.
- Risk: unavailable or unauthenticated plugins.
- UI action: sometimes.

## 0.122.0

### Windows Codex App improvements
- Benefit: smoother ORION Windows workflow.
- Use: prefer app-native terminal/browser evidence.
- Do not use: to skip OS-specific audit.
- Risk: app version matters.
- UI action: maybe.

### `/side` conversations and Plan Mode fresh context
- Benefit: side analysis without disturbing main thread; clean planning.
- Use: side only for non-blocking analysis, Plan Mode for brief planning.
- Do not use: side threads for final validation.
- Risk: evidence fragmentation.
- UI action: yes.

### Plugin workflows, deny-read policies, tool discovery, image handling
- Benefit: better tool selection and scoped access.
- Use: tool discovery only for task need.
- Do not use: deny-read as sole data protection.
- Risk: policy drift if not recorded.
- UI action: sometimes.

## 0.123.0

### `/mcp verbose`
- Benefit: deeper MCP diagnostics.
- Use: at start of major runs if available.
- Do not use: when CLI exposes only `codex mcp list`; record limitation.
- Risk: interactive command may not be available in noninteractive shell.
- UI action: no or interactive only.

### Flexible `.mcp.json`, realtime handoffs, remote_sandbox_config, model metadata
- Benefit: better server config, handoffs, remote sandbox, model discovery.
- Use: prefer model discovery before pinning custom agents.
- Do not use: remote sandbox without trust review.
- Risk: config may differ between app, CLI, and remote.
- UI action: sometimes.

## 0.124.0

### Reasoning controls
- Benefit: high reasoning for governance and cross-module decisions.
- Use: high for ORION implementation/validation; low for lookups.
- Do not use: high reasoning as substitute for tests.
- Risk: cost/token use.
- UI action: yes.

### Multi-environment app-server
- Benefit: keep app/API/docs contexts separated.
- Use: sticky environment discipline.
- Do not use: if environment provenance is unclear.
- Risk: stale terminal/server state.
- UI action: maybe.

### Bedrock support
- Benefit: documented future provider option only.
- Use: do not use unless ORION later has a documented need.
- Do not use: default ORION work.
- Risk: provider behavior and compliance review.
- UI action: yes.

### Stable hooks, remote marketplaces, Fast service tier, permission drift fixes
- Benefit: more reliable guardrails, controlled plugin installs, lower latency, better profile consistency.
- Use: repo-local hooks and config snippets; trust-review remote marketplaces.
- Do not use: hooks as hard security boundary.
- Risk: global enablement may require user action.
- UI action: often for hooks/marketplaces.

## GPT-5.5 And Codex App Updates

- Benefit: stronger model for large codebases, debug, tests, validation, and knowledge artifacts.
- Use: GPT-5.5 as default for heavy ORION work.
- Do not use: mini models for final architectural/verdict decisions.
- Risk: availability can vary; record fallback.
- UI action: model selection in app.

- Benefit: Browser Use improves UI verification.
- Use: local preview walkthroughs and screenshots.
- Do not use: docs-only passes.
- Risk: unavailable browser auth/ports.
- UI action: yes.

- Benefit: automatic approval reviews reduce friction.
- Use: approval governance with scoped commands.
- Do not use: to justify destructive actions.
- Risk: review can reject broad commands.
- UI action: no, if configured.

## 0.125.0

### Unix socket app-server and pagination-friendly resume/fork
- Benefit: improved app-server transport and long-thread navigation.
- Use: resume/fork intentionally for ORION branches.
- Do not use: fork to fragment final validation.
- Risk: state drift.
- UI action: maybe.

### Sticky environments
- Benefit: keep docs, API, web, and scripts work scoped.
- Use: state intended package/path in prompts.
- Do not use: to skip current working directory checks.
- Risk: stale environment assumptions.
- UI action: no.

### Remote plugin install and marketplace upgrades
- Benefit: controlled capability expansion.
- Use: only after trust review and documentation.
- Do not use: random upgrades during product work.
- Risk: supply-chain and permission drift.
- UI action: likely.

### Permission profiles round-trip
- Benefit: better consistency across app, CLI, MCP, and shell.
- Use: record permission mode and approvals in run packs.
- Do not use: as proof commands were safe.
- Risk: profile can still require user review.
- UI action: maybe.

### Model discovery
- Benefit: validates GPT-5.5 availability before custom agent pinning.
- Use: `codex debug models` when needed.
- Do not use: to store long catalog dumps in final reports.
- Risk: catalog output is large.
- UI action: no.

### Reasoning-token usage in `codex exec --json`
- Benefit: future automation cost/evidence reporting.
- Use: for noninteractive automation where available.
- Do not use: interactive app sessions without data.
- Risk: not all sessions expose usage.
- UI action: no.

### Rollout tracing for tools, code-mode, sessions, multi-agent
- Benefit: better diagnostics and governance evidence.
- Use: record tracing availability if surfaced.
- Do not use: as correctness proof.
- Risk: implementation details can change.
- UI action: no.

### Windows sandbox improvements
- Benefit: safer ORION Windows execution and fewer hidden process issues.
- Use: workspace-write, hidden background helpers, scoped approvals.
- Do not use: Full Access by default.
- Risk: Windows app packaging can block bundled tools.
- UI action: sometimes.

### Config/schema handling improvements
- Benefit: more reliable hooks, profiles, MCP, and plugins.
- Use: keep repo snippets valid TOML/JSON.
- Do not use: unvalidated snippets.
- Risk: project snippets may not be auto-enabled.
- UI action: yes when enabling.
