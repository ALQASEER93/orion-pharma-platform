# ORION Hooks Installation And Limitations

This repository contains proposed Codex hook guardrails under `.codex/hooks/` and `.codex/hooks.json`.

## What The Hooks Guard
- Destructive commands: `git reset --hard`, `git clean -fd`, `rm -rf`, `del /s /q`, recursive force removal, force push, push to main.
- Deleting `docs/_runs`, migration history, or lockfiles without explanation.
- Non-ORION env vars and shared imports when surfaced in tool events.
- PASS claims without run folder, `verification.json`, zip, LATEST update, and clean git proof.
- UI changes without browser/screenshot evidence.
- Schema/model/migration changes without tests.
- Accounting/ledger changes without balancing invariant tests.
- GitHub/PR side effects before local verification.
- Non-`codex/*` branch work.

## Installation
Project-level hook auto-enablement was not assumed in this Codex App session. Keep the scripts committed and enable them through the active Codex CLI/App hook configuration only after confirming the exact supported schema.

Suggested config source is `.codex/hooks.json`. Suggested TOML is in `docs/codex/ORION_CODEX_CONFIG_SNIPPET.toml`.

## Limitations
- Hooks are guardrails, not a security boundary.
- Hook event schemas can differ across Codex releases.
- Global/user config should not be edited from a repo governance pass without explicit approval.
- Auto-review can still reject broad commands even when hooks allow them.
- Hooks do not prove PASS; they only warn or block selected risk patterns.
