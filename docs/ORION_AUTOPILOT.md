# ORION Autopilot

## Goal
- Provide a repeatable multi-agent execution layer for ORION work without refactoring the application.
- Keep orchestration, task fanout, and report merging inside tooling only.
- Preserve strict isolation mode: ORION-prefixed environment variables only, `@orion/*` import boundaries only.

## Agent Roles
- `architect`
  - Scope: planning, task decomposition, acceptance criteria, constraint enforcement.
  - Ownership: `.codex/`, `docs/`, orchestration planning artifacts.
- `backend`
  - Scope: bounded API work and backend test coverage.
  - Ownership: `apps/api/` when explicitly assigned.
- `frontend`
  - Scope: bounded UI/PWA work and web regression coverage.
  - Ownership: `apps/web/` when explicitly assigned.
- `security`
  - Scope: auth, secret, tenancy, and transport review.
  - Ownership: review-only across app and deployment boundaries unless explicitly tasked.
- `qa`
  - Scope: deterministic test generation and acceptance validation.
  - Ownership: test files and verification notes.
- `deploy`
  - Scope: deployment validation, Compose guardrails, backup/restore, rollback documentation.
  - Ownership: `deploy/`, `scripts/`, deployment docs, Compose files.

Agent definitions live under:
- `.codex/agents/architect.agent.md`
- `.codex/agents/backend.agent.md`
- `.codex/agents/frontend.agent.md`
- `.codex/agents/security.agent.md`
- `.codex/agents/qa.agent.md`
- `.codex/agents/deploy.agent.md`

## Execution Flow
1. `architect` converts the request into bounded tasks and constraints.
2. `backend` handles API work when the plan includes server-side changes.
3. `frontend` handles UI/PWA work when the plan includes client-side changes.
4. `security` reviews auth, secret, and isolation boundaries.
5. `qa` generates regression coverage and acceptance validation.
6. `deploy` validates release guardrails, healthchecks, backup paths, and rollback notes.

Workflow config lives in:
- `.codex/orion-autopilot.toml`

Task fanout template lives in:
- `docs/_runs/templates/orion_tasks.csv`

## Command Helper
- Script: `scripts/run-orion-agents.mjs`
- Purpose:
  - launch a Codex non-interactive session that instructs Codex to use `spawn_agents_on_csv`
  - write a results CSV under `docs/_runs/agent_results/`
  - merge the CSV into a Markdown report

Example dry run:
```bash
node scripts/run-orion-agents.mjs --dry-run
```

Example execution:
```bash
node scripts/run-orion-agents.mjs --csv docs/_runs/templates/orion_tasks.csv
```

Outputs:
- `docs/_runs/agent_results/orion_autopilot_results_<timestamp>.csv`
- `docs/_runs/agent_results/orion_autopilot_report_<timestamp>.md`

## Safety Rules
- No application refactor through autopilot orchestration itself.
- No Prisma schema or migration changes through autopilot scaffolding.
- Agent scopes must stay within their declared allowed directories.
- Security review is mandatory for auth, secret, tenant, and transport-sensitive work.
- QA output must prove acceptance criteria before merge.
- Deploy validation must keep production DB/API private behind the edge proxy.

## Operational Notes
- `scripts/run-orion-agents.mjs` does not fabricate results locally; it expects the Codex run to create the results CSV.
- If the Codex session finishes without producing the output CSV, the helper fails hard.
- This keeps report generation honest and bounded to actual agent fanout output.
