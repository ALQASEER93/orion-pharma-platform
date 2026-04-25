# ORION Codex Upgrade Guide: 0.118.0 to 0.125.0

Last verified: 2026-04-25

This document is ORION-only. Use it when prompting Codex for work in `D:\ORION_PHARMA_PLATFORM\orion-pharma-platform`.

## Verified State

- Previous Codex CLI version used for ORION work: `codex-cli 0.118.0`.
- Current verified Codex CLI version: `codex-cli 0.125.0`.
- Current stable npm release: `@openai/codex 0.125.0`.
- Latest alpha seen during verification: `0.126.0-alpha.1`.
- Recommendation for ORION: use stable releases only unless testing in an isolated branch or throwaway environment.

ORION project shape verified locally:

- Repository root: `D:\ORION_PHARMA_PLATFORM\orion-pharma-platform`.
- Package manager: `pnpm@10.6.1`.
- Web app: `apps/web`, Next.js `14.2.28`, React `18`, Tailwind.
- API app: `apps/api`, NestJS `11`, Prisma `6.16.2`, Jest.
- Repository commands:
  - `corepack pnpm -r --if-present run typecheck`
  - `corepack pnpm -r --if-present run test`
  - `corepack pnpm -r --if-present run build`
  - `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/quickgate.ps1`

## What Changed And Why ORION Cares

### 0.119.0

Main improvements:

- Stronger realtime and app-server work.
- Better MCP app and custom MCP server support.
- Better resume behavior by session name or id.
- Copy-last-response shortcut improvements.
- Better notifications and TUI behavior.
- Sandbox and network-related fixes.

ORION value:

- Better for long ORION sessions where the same investigation spans UI, API, Prisma schema, and tests.
- More reliable when using tools or integrations around the repository.
- Useful when reviewing prior ORION work because resume is less fragile.

How to use it in prompts:

```text
Resume the ORION context from this branch, inspect the current state first, and continue only from verified files and commands. Do not assume prior state.
```

### 0.120.0

Main improvements:

- More visible progress while background agents or tools are running.
- Better hook visibility.
- Better MCP result typing through output schemas.
- Windows sandbox and writable-root fixes.

ORION value:

- Better visibility during long `pnpm`, Prisma, Jest, or build runs.
- Better Windows behavior for this repository because ORION is being worked on from Windows paths.
- Safer execution when Codex needs to work across `apps/web`, `apps/api`, `docs`, and scripts.

How to use it in prompts:

```text
Run only the ORION validation commands that match the files changed. Report the exact command, whether it passed, and the relevant failing lines if it fails.
```

### 0.121.0

Main improvements:

- `codex marketplace add`.
- Better TUI command history with `Ctrl+R`.
- Memory mode reset/delete/cleanup.
- Expanded MCP Apps and parallel tool call support.
- More app-server and realtime events.
- More secure devcontainer profile work.

ORION value:

- Better repeated prompting because important ORION prompts can be recalled faster.
- Memory cleanup is useful when switching between ORION slices so stale assumptions do not carry across tasks.
- Parallel tool calls help inspect ORION web/API/schema/test files faster.

How to use it in prompts:

```text
Before changing code, inspect AGENTS.md, the relevant package scripts, and the specific ORION files for this slice in parallel. Then summarize the smallest safe change.
```

### 0.122.0

Main improvements:

- Better `codex app` behavior on Windows.
- `/side` side conversations.
- Slash commands and shell prompts can be queued while work is running.
- Plan Mode can start execution in a new context.
- Stronger plugin workflows and marketplace handling.
- Tool discovery and image generation enabled by default.
- Stronger file and permission policy handling.

ORION value:

- `/side` is useful for asking a separate question while preserving the main ORION implementation thread.
- Tool discovery helps when ORION needs browser checks, UI evidence, diagrams, or repo-local tools.
- Stronger permission handling reduces accidental broad edits.
- Better Windows desktop integration matters for the Codex Desktop workflow shown in the current environment.

How to use it in prompts:

```text
Use a side thread only for analysis that must not disturb the main ORION implementation. Keep the main thread focused on the active slice and validation.
```

```text
This is an ORION UI change. Inspect the page, implement the bounded change, then collect browser evidence for the changed route before claiming completion.
```

### 0.123.0

Main improvements:

- Built-in Amazon Bedrock provider support.
- `/mcp verbose` for deeper MCP diagnostics.
- Broader `.mcp.json` support.
- Better handoff behavior for background agents.
- Remote sandbox config improvements.
- Model metadata updates.

ORION value:

- `/mcp verbose` is useful if ORION browser, filesystem, GitHub, or other tools are not behaving as expected.
- Better handoffs help larger ORION investigations where discovery and implementation are separated.
- Provider improvements are mostly optional for ORION unless the project later uses provider-specific workflows.

How to use it in prompts:

```text
If an MCP or browser tool fails, diagnose the tool state first. Do not replace browser evidence with assumptions.
```

### 0.124.0

Main improvements:

- Reasoning shortcuts in the TUI.
- Better multi-environment app-server handling.
- Better remote plugin marketplace support.
- Hooks became more stable and configurable.
- Fast service tier enabled by default for eligible plans.

ORION value:

- Reasoning controls matter for ORION because different tasks need different depth:
  - low/fast for simple file lookups.
  - medium for small edits.
  - high for API, Prisma, auth, POS, pharmacy workflow, or UI architecture.
- Multi-environment handling helps keep `apps/web` and `apps/api` work separated.
- Hooks can support ORION discipline later, for example enforcing brief checks or validation logs.

How to use it in prompts:

```text
Use high reasoning for this ORION task because it touches cross-module behavior. Keep the edit minimal and verify the exact affected package.
```

```text
Use low reasoning for a quick ORION lookup only. Do not edit files. Return file paths and line references.
```

### 0.125.0

Main improvements:

- Better app-server transport support.
- Better resume and fork with pagination.
- Sticky environments.
- Remote thread config/store improvements.
- Remote plugin install and marketplace upgrade support.
- Permission profiles are passed more consistently between TUI, MCP, shell escalation, and app-server.
- `codex exec --json` includes reasoning-token usage.
- Better tracing.
- Windows fixes around startup and hidden background processes.

ORION value:

- Sticky environments are important for ORION because work often stays in one of these scopes:
  - `apps/web`
  - `apps/api`
  - `prisma`
  - `docs`
  - `scripts`
- Better resume/fork helps continue an ORION issue without losing prior validation context.
- Permission profile consistency matters when browser checks, shell commands, and MCP tools all happen in one task.
- Windows process fixes reduce noisy or disruptive background command windows.
- `codex exec --json` can support future automation reports for ORION run packs or CI-like local checks.

How to use it in prompts:

```text
Stay in the ORION environment for this slice. Do not cross into unrelated repositories. Keep the working directory at the repository root unless a package command requires a subdirectory.
```

```text
Fork the previous ORION investigation only if the new question is separate from the implementation path. Otherwise resume the same thread.
```

## ORION Prompting Rules After The Upgrade

Use these rules in future ORION prompts.

### Always Start With Scope

Good prompt:

```text
ORION only. Scope: apps/web POS checkout screen. Goal: make the sale workflow usable for a pharmacy cashier. Inspect current files first, propose the smallest safe implementation, then edit and verify.
```

Why:

- The newer Codex versions are better at multi-step work, but precise scope still prevents broad edits.
- ORION has web, API, Prisma, docs, and scripts; scope controls blast radius.

### Always Ask For Evidence

Good prompt:

```text
After implementation, run the smallest relevant ORION validation commands and report exact results. If UI changed, capture browser evidence for the changed route.
```

Why:

- Codex 0.125.0 has better tool handling, but completion still depends on actual verification.
- ORION should not accept claims without command output or browser evidence.

### Separate Analysis From Implementation

Good prompt:

```text
First inspect the relevant ORION files and summarize findings. Then implement only the approved bounded fix. Do not refactor unrelated code.
```

Why:

- The new resume/fork/side capabilities make it easier to preserve context.
- This keeps ORION changes reviewable.

### Use The Right Reasoning Level

Use high reasoning for:

- Prisma schema changes.
- Auth, RBAC, tenant isolation, pharmacy compliance, inventory, POS, or invoice behavior.
- Cross-package work between `apps/web` and `apps/api`.
- UI redesign or workflow redesign.

Use medium reasoning for:

- One-page UI fixes.
- Simple API route additions.
- Focused tests.

Use low reasoning for:

- File lookup.
- Version checks.
- Listing commands or package scripts.

### Use `/side` For Non-Blocking Questions

Use `/side` for:

- Asking for a second opinion on UI copy.
- Comparing two implementation approaches.
- Checking a release note or command meaning while the main task remains intact.

Do not use `/side` for:

- The main implementation.
- Validation that must be attached to the final claim.

### Use Resume And Fork Intentionally

Use resume when:

- Continuing the same ORION task.
- The prior validation and decisions still matter.

Use fork when:

- Exploring an alternate fix.
- Testing a different UI direction.
- Investigating a separate root cause.

Prompt:

```text
Resume the last ORION thread for this issue. Keep the previous validation context. Before editing, re-check git status and the relevant files.
```

## ORION Workflows To Use Now

### UI Work

Prompt template:

```text
ORION only.
Task type: UI.
Scope: apps/web/<route or component>.
Goal: <user-facing outcome>.
Constraints: preserve existing API contracts, keep changes minimal, no unrelated refactors.
Process:
1. Inspect AGENTS.md and the relevant ORION files.
2. Identify the current UX problem with file references.
3. Implement the smallest safe change.
4. Run web typecheck/build or the smallest relevant command.
5. Open the changed route in a browser and collect visual evidence.
6. Final answer must include changed files and verification results.
```

Recommended validation:

```powershell
corepack pnpm --filter @orion/web typecheck
corepack pnpm --filter @orion/web build
```

Use browser evidence when:

- Layout changed.
- Text, controls, form behavior, POS, product, supplier, stock, or invoice screens changed.
- Mobile/responsive behavior changed.

### API Work

Prompt template:

```text
ORION only.
Task type: API.
Scope: apps/api/<module>.
Goal: <API behavior>.
Constraints: preserve tenant isolation, DTO validation, Prisma consistency, and existing tests.
Process:
1. Inspect the module, DTOs, Prisma schema, and tests before editing.
2. Implement a minimal change.
3. Add or update focused tests where behavior changed.
4. Run API typecheck and tests.
5. Report exact verification.
```

Recommended validation:

```powershell
corepack pnpm --filter @orion/api typecheck
corepack pnpm --filter @orion/api test
```

### Prisma And Data Model Work

Prompt template:

```text
ORION only.
Task type: Prisma/data.
Scope: apps/api/prisma plus affected API modules.
Goal: <schema or data behavior>.
Constraints: no destructive migration without explicit approval, preserve tenant data boundaries, update seed/tests only if required.
Process:
1. Inspect current Prisma schema, migration scripts, and affected services.
2. Explain migration impact before editing.
3. Implement the smallest compatible migration.
4. Run Prisma verification and affected tests.
```

Recommended validation:

```powershell
corepack pnpm --filter @orion/api prisma:verify
corepack pnpm --filter @orion/api typecheck
corepack pnpm --filter @orion/api test
```

### Documentation Work

Prompt template:

```text
ORION only.
Task type: docs.
Scope: docs/<area>.
Goal: make the instructions accurate for the current repo.
Constraints: verify commands from package.json before documenting them.
Process:
1. Inspect current scripts and existing docs.
2. Update only the relevant doc.
3. Report what was verified and what was not run.
```

### Review Work

Prompt template:

```text
ORION only.
Review my current changes as a code review.
Prioritize bugs, regressions, missing validation, tenant isolation risks, pharmacy workflow risks, and missing tests.
Return findings first with file and line references. Do not summarize before findings.
```

## Feature-To-Use Map For ORION

Use this map when choosing how to work.

| Codex feature | Use in ORION | Practical instruction |
| --- | --- | --- |
| Better resume/fork | Continue or branch long ORION tasks | Resume same issue; fork only for alternatives |
| `/side` | Ask separate questions without disturbing main implementation | Keep validation in main thread |
| Tool discovery | Find browser, GitHub, docs, or MCP tools when needed | Ask Codex to discover tools only for the task |
| Better permission profiles | Safer shell/browser/MCP execution | Keep commands scoped to ORION root |
| Sticky environments | Stay in web/API/docs scope | Name the intended package in the prompt |
| Better Windows process handling | Fewer disruptive terminal windows | Prefer package scripts and repository commands |
| Reasoning shortcuts | Match task difficulty | high for cross-module, medium for focused edits, low for lookup |
| `codex exec --json` usage stats | Future automation/reporting | Useful for run-pack or scheduled checks later |
| Better plugin marketplace | Future ORION-specific tools | Use only ORION-relevant plugins/tools |
| Better MCP diagnostics | Debug tool failures | Use `/mcp verbose` when a tool fails |

## Update Checking For ORION

Manual check:

```powershell
codex --version
npm view @openai/codex version
```

Stable update command:

```powershell
npm install -g @openai/codex@latest
```

Recommended ORION policy:

- Check weekly or before a major ORION stage.
- Update only to stable unless testing outside the main ORION workflow.
- After updating, verify:

```powershell
codex --version
```

- Do not claim an ORION task is complete just because Codex updated. Completion still requires ORION validation commands and evidence.

## Next Steps For ORION

1. Keep `0.125.0` as the current stable baseline.
2. Use the prompt templates above for the next ORION tasks.
3. For UI work, require browser evidence after every visible change.
4. For API/data work, require typecheck and focused tests before completion.
5. For cross-module tasks, use high reasoning and explicitly name affected packages.
6. For large changes, split work by slice:
   - web UI
   - API behavior
   - Prisma/data model
   - docs/runbook
   - validation evidence
7. Before any stage advancement, require a stage-gate style verdict backed by commands and artifacts.

## Best Single Prompt To Start The Next ORION Task

```text
ORION only. Work in D:\ORION_PHARMA_PLATFORM\orion-pharma-platform.

Read AGENTS.md first and follow repo-local ORION guidance. Do not use assumptions from any other repository.

Task:
<describe the exact ORION feature or fix>

Scope:
<apps/web route, apps/api module, Prisma area, docs path, or scripts path>

Requirements:
- Inspect the current files before editing.
- Keep the change minimal and maintainable.
- Preserve tenant isolation, pharmacy workflow correctness, and existing contracts.
- If UI changes, collect browser evidence for the changed route.
- If API/data changes, run the relevant typecheck/tests.
- Do not claim completion unless verification actually ran.

Final response:
- Changed files.
- Exact validation commands and results.
- Remaining risks or unverified items.
```

## Release Sources

- `@openai/codex` npm package: https://www.npmjs.com/package/@openai/codex
- `0.119.0`: https://github.com/openai/codex/releases/tag/rust-v0.119.0
- `0.120.0`: https://github.com/openai/codex/releases/tag/rust-v0.120.0
- `0.121.0`: https://github.com/openai/codex/releases/tag/rust-v0.121.0
- `0.122.0`: https://github.com/openai/codex/releases/tag/rust-v0.122.0
- `0.123.0`: https://github.com/openai/codex/releases/tag/rust-v0.123.0
- `0.124.0`: https://github.com/openai/codex/releases/tag/rust-v0.124.0
- `0.125.0`: https://github.com/openai/codex/releases/tag/rust-v0.125.0
