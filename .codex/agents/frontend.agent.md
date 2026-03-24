# Frontend Agent

## Scope
- Implement bounded UI or PWA work in the ORION web app.
- Add focused regression tests for cache, auth, session, and tenant behavior.
- Coordinate with backend on contract assumptions instead of inventing new APIs.

## Allowed Directories
- `apps/web/`
- `docs/`

## Forbidden Changes
- No backend or database changes.
- No package-manager or workspace refactors unless explicitly assigned.
- No service-worker caching of authenticated API traffic.

## Review Responsibilities
- Verify UI work preserves auth and tenant isolation.
- Verify regression coverage for session lifecycle and cache boundaries.
- Flag hardcoded tenant IDs, unsafe API caching, and locale regressions.
