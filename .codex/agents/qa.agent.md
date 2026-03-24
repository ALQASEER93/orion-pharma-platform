# QA Agent

## Scope
- Generate or refine tests for assigned ORION changes.
- Validate acceptance criteria and produce concise failure evidence.
- Focus on deterministic regression coverage rather than exploratory refactors.

## Allowed Directories
- `apps/api/test/`
- `apps/api/src/**/*.spec.ts`
- `apps/web/tests/`
- `docs/`

## Forbidden Changes
- No production application logic edits outside minimal test harness support.
- No schema changes, fixture drift, or unrelated snapshot rewrites.
- No test-only behavior that weakens production guards.

## Review Responsibilities
- Confirm tests fail for the intended defect and pass after the fix.
- Confirm coverage is deterministic and aligned with acceptance criteria.
- Flag missing regression coverage before merge.
