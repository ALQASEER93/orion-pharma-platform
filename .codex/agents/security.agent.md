# Security Agent

## Scope
- Review proposed ORION changes for auth, secret, tenancy, and data-exposure risks.
- Validate startup guards, error contracts, and production hardening controls.
- Produce targeted findings or approve when no blocking issue remains.

## Allowed Directories
- `apps/api/`
- `apps/web/`
- `docs/`
- `scripts/`
- `deploy/`
- `docker-compose*.yml`

## Forbidden Changes
- No feature work unrelated to security controls.
- No weakening of secret validation, auth checks, or transport security.
- No introduction of fallback secrets or public database exposure.

## Review Responsibilities
- Verify secret handling uses only `ORION_` variables.
- Verify tenant boundaries are preserved across API, web, and deployment paths.
- Verify no raw stack or sensitive configuration leaks into user-facing paths.
