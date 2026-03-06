# ORION PHARMA Pillar Audit (Report + Plan Only)

## Context
- Source run: `docs/_runs/run_20260305_174959`
- Fanout input: `docs/_runs/run_20260305_174959/json/audit_fanout.csv`
- Fanout output: `docs/_runs/run_20260305_174959/json/audit_fanout_results.csv`
- Fanout job id: `6ea67944-b3dd-4887-8df1-73981bc6d5df`
- Scope mode: audit/report/planning only (no large refactor executed).

## Agent Progress + ETA
| Agent | Area | Progress | ETA (min) |
|---|---|---|---:|
| Backend_API_Audit | Backend/API | Audit complete; remediation not started | 190 |
| Accounting_Integrity_Audit | GL/AR/AP/Inventory valuation | Audit complete; remediation not started | 480 |
| Web_PWA_Audit | Web/PWA auth-session-tenant context | Audit complete; remediation design ready | 300 |
| i18n_RTL_Audit | Arabic/English + RTL | Audit complete; remediation not started | 360 |
| Security_MultiTenant_Audit | Security + multi-tenant isolation | Audit complete; remediation not started | 360 |
| Minimal_Cost_Deploy_Plan | Single VPS + compose | Audit complete; deployment hardening plan ready | 420 |

## Pillar 1: Backend/API Reliability
- P0:
- Non-idempotent POS checkout can duplicate invoice/payment posting on retries.
- Raw `Error` throw in middleware can break error contract with uncontrolled 500 behavior.
- P1:
- Validation allows unknown fields silently (`forbidNonWhitelisted` not enabled).
- UUID params lack strict boundary validation across multiple controllers.
- Public login route has no explicit throttling.
- P2:
- Sales controller route style inconsistent; tenant source precedence in login is ambiguous when header/body differ.

## Pillar 2: Accounting Integrity (GL/AR/AP/Inventory)
- P0:
- Inventory reconciliation compares GL business date against inventory `createdAt`, causing historical mismatch risk.
- Void logic can invalidate as-of historical AR/AP reconciliation due to destructive state overwrite.
- P1:
- AR/AP aging is current-state based, not true as-of.
- AR receipt posting transition lacks explicit affected-row guard after journal posting.
- P2:
- Period close lacks hard gate requiring reconciliation deltas within tolerance.

## Pillar 3: Web/PWA Session + Tenant Boundary
- P0:
- Service worker caches authenticated `/api/*` responses without tenant/user partitioning.
- P1:
- No centralized web session lifecycle (login/logout/route guard/expiry handling).
- Tenant context is page-editable, enabling drift and operator errors.
- P2:
- Hardcoded tenant/branch defaults remain in multiple pages.

## Pillar 4: i18n/RTL (Arabic + English)
- P0:
- Root document is fixed `lang="en"` and not locale/dir-aware.
- No centralized localization layer; UI copy mostly hardcoded in components.
- P1:
- Arabic-first UX gaps: EN name fields shown in key flows.
- Date/number/currency formatting uses English assumptions.
- Mixed bilingual inline labels lead to inconsistent UX.
- P2:
- Typography/manifest localization are not optimized for Arabic install/runtime experience.

## Pillar 5: Security + Multi-Tenant Isolation
- P0:
- Hardcoded/default JWT secret fallback can enable token forgery if env secret is weak/missing.
- P1:
- Login errors leak tenant/user validity signals.
- Global tenant fallback from `x-tenant-id` is a latent isolation bypass path.
- P2:
- AuthZ depends heavily on JWT claims until token expiry (revocation window risk).

## Pillar 6: Minimal-Cost Deployment (Single VPS + Compose)
- P0:
- Current compose publishes DB/API ports and lacks TLS reverse-proxy edge.
- Default secret patterns can leak into production path.
- No mandatory backup/restore control for Postgres volume.
- P1:
- Incomplete health checks for app services.
- Builds are not fully deterministic (`--frozen-lockfile=false`, mutable base image tags).
- Migration runs on every API container start instead of release step.
- P2:
- Production runbook and hardened deployment docs are incomplete.

## Cross-Pillar Immediate Direction
- First stabilization wave should target P0 only:
- API idempotency + error contract normalization.
- Accounting as-of timeline correctness.
- PWA cache isolation for authenticated APIs.
- JWT secret hard-fail + login response normalization.
- TLS-only edge + private DB/API network + backups.

## P0-API+SEC Implemented
- Scope implemented on branch `codex/p0-api-sec-idempotency`: `BAPI-P0-001`, `BAPI-P0-002`, `P0-SEC-001`.
- Evidence run: `docs/_runs/run_20260306_090236/`
- Status source: `docs/_runs/run_20260306_090236/json/status.json`
- Outcome: `overall_pass = true`, `blockers = []`
- Delivered:
- POS checkout idempotency via `(tenantId, idempotencyKey)` with payload hash replay/conflict behavior.
- Deterministic 401 JSON for missing role context in authenticated request pipeline, with no raw stack leakage in the tested path.
- ORION-only JWT secret enforcement with startup hard-fail on missing/weak secret.
