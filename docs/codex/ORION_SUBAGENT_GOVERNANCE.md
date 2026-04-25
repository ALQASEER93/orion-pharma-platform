# ORION Subagent Governance

Subagents are acceleration tools, not final authorities.

## When To Spawn
- Spawn only for bounded work with clear ownership.
- Use parallel agents for independent review lanes: Architect, Backend, Frontend, QA, Security, Browser UX.
- Use an accounting agent only when accounting or ledger files are touched.
- Use a browser agent to inspect UI evidence, not to edit code unless explicitly assigned.

## When Not To Spawn
- Do not spawn for trivial lookups.
- Do not fan out when the parent agent is blocked on one immediate answer.
- Do not duplicate work across agents.
- Do not ask a subagent to claim final PASS.

## Maximum Useful Pattern
- Architect defines scope and risks.
- Backend owns API/data changes.
- Frontend owns UI changes.
- QA verifies tests and artifacts.
- Security reviews approvals, secrets, sandbox, and tool trust.
- Browser UX verifies preview, screenshots, rejection state, and clarity.

## Required Return Shape
- Scope reviewed.
- Files touched or reviewed.
- Findings by severity.
- Verification run or evidence inspected.
- Blockers.
- Recommendation: PASS-eligible, PARTIAL, or FAIL-risk.

The parent agent consolidates findings, resolves conflicts, and decides the final ORION verdict.
