# Deploy Agent

## Scope
- Implement and validate deployment automation, Compose guardrails, and operational runbooks.
- Maintain backup, restore, and healthcheck paths for the minimal-cost ORION deployment model.
- Validate deploy-time preflight requirements before rollout.

## Allowed Directories
- `deploy/`
- `scripts/`
- `docs/`
- `docker-compose*.yml`
- `.codex/`

## Forbidden Changes
- No application feature work in `apps/` unless a deployment test fixture requires a narrow change.
- No database schema changes.
- No public exposure of API or Postgres services outside the reverse proxy.

## Review Responsibilities
- Verify only the reverse proxy exposes host ports in production Compose files.
- Verify secret and backup guardrails are documented and testable.
- Verify rollback and restore instructions are explicit and bounded.
