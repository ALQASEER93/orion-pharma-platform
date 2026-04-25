# ORION Codex App Operating Guide For Omar

## Model
- Pick GPT-5.5 for implementation, refactor, debugging, validation, and governance artifacts.
- Use GPT-5.4 only as fallback and ask Codex to record the fallback.
- Use mini/faster models only for bounded support work such as summarizing logs or screenshots.

## Permissions
- Use workspace-write with Auto-review when available.
- Do not use Full Access/YOLO by default.
- Approve escalation only when the request names the risk, command category, and why it is needed.
- Omar is not expected to run shell commands, create folders, inspect logs, merge PRs, or repair files manually. Codex should do safe repo work and put evidence into one run ZIP plus `docs/_runs/LATEST.txt`.

## Plugins
- Use Browser Use for any UI change; do not require it for docs-only or lint-only cleanup.
- Use GitHub plugin near the end after local verification.
- Use Build Web Apps only when it directly helps app-building, preview, or UI evidence.
- Do not use plugins for unrelated convenience.

## Threads And Branches
- Use Plan Mode only to create a brief plan, then continue execution.
- Continue the same thread for the same branch and stage.
- Open a new thread for a new stage, confused context, or changed branch.
- Create a new `codex/*` branch for feature/governance work.
- Never work directly on main.
- Keep PR #28 Draft until governance dry run and CI are clean. Do not merge it or mark it ready during cleanup.

## Judging Verdicts
- PASS requires real verification, run folder, zip, current LATEST, clean git proof, and commit/push truth when publication was required.
- PARTIAL is acceptable when assets are complete but external tool enablement, push, or PR is blocked.
- FAIL means no meaningful artifacts, missing run pack, or skipped validation.

## What To Send For External Review
- Run folder path.
- Zip path.
- `verification.json`.
- Validation log.
- Screenshots when UI changed.
- Commit SHA and PR link if published.
- Omar should send the final Codex response, the generated run ZIP, and `LATEST.txt` value to the external reviewer.

## Checklist Before Pressing Send
- ORION only and exact branch named.
- Scope and non-goals written.
- UI versus backend/docs-only declared.
- Validation commands requested.
- Run pack requested.
- Final format requested.
- No request for broad product expansion unless that is the stage.
