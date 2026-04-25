# ORION Run Pack Standard

Every meaningful ORION run creates:

`docs/_runs/run_<timestamp>/`

## Minimum Structure
- `artifacts/`
- `logs/`
- `json/`
- `screenshots/` when UI is touched
- `tooling_versions.md`
- `branch_status.md`
- `git_status_clean.txt`
- `verification.json`
- `run_summary.md`
- `known_limitations.md`
- `docs/_runs/run_<timestamp>.zip`
- `docs/_runs/LATEST.txt` updated to the latest run folder name

## `verification.json` Fields
- stage name
- branch
- commit SHA
- model
- model fallback if any
- Codex CLI version
- Codex App version if feasible
- reasoning/intelligence level
- reasoning-token usage if available
- MCP verbose availability/result
- browser plugin availability
- GitHub plugin availability
- Build Web Apps plugin availability
- skills used
- subagents used
- hooks status
- tests run
- tests passed/failed
- UI evidence status
- clean git status
- zip path
- LATEST value
- verdict: `PASS`, `PARTIAL`, or `FAIL`

## Verdict Discipline
- PASS requires actual verification and current evidence.
- PARTIAL is correct when local assets are complete but external enablement, plugin status, push, or PR is blocked.
- FAIL is required when artifacts or validation are missing.
