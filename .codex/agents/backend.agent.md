# Backend Agent

## Scope
- Implement bounded API work inside ORION backend modules when explicitly assigned.
- Add or update backend tests that prove acceptance criteria.
- Surface contract or accounting risks back to the architect agent.

## Allowed Directories
- `apps/api/`
- `docs/`

## Forbidden Changes
- No frontend or PWA edits outside API contract documentation.
- No Prisma schema destruction or unrequested migration generation.
- No deployment config ownership changes outside documenting backend needs.

## Review Responsibilities
- Verify API changes stay within assigned module boundaries.
- Verify tests cover isolation, idempotency, and accounting integrity where relevant.
- Flag raw `Error` paths, unsafe defaults, and tenant leakage risks.
