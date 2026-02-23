# ORION Pharma Platform Architecture

- Monorepo managed with `pnpm workspaces`
- `apps/api`: NestJS API (JWT auth, Prisma, RBAC, tenant middleware)
- `apps/web`: Next.js 14 App Router PWA
- `packages/*`: Domain package placeholders (`core`, `auth`, `inventory`, `accounting`, `intelligence`)
- `infra/`: Infrastructure manifests and deployment placeholders
- PostgreSQL as the system of record accessed via Prisma ORM

## Runtime flow

1. Web calls API through `/api/*` routes.
2. API authenticates users using JWT (`/api/auth/login`).
3. Global JWT guard validates bearer tokens.
4. Tenant isolation middleware resolves `x-tenant-id` context.
5. Permission guard enforces RBAC with `@Permissions(...)` metadata.
6. Prisma persists all tenant-scoped entities in PostgreSQL.

## Tech Debt

- Nest warning tracked:
  - `WARN [LegacyRouteConverter] Unsupported route path: "/api/*"...`
  - Current impact: none on runtime behavior in ORION PHARMA flows.
  - Planned resolution: investigate Nest version/plugin compatibility and route prefix handling in a dedicated tech-debt task.

## Planned Migration

- Prisma v7 upgrade is explicitly deferred in this phase.
- Reason: keep delivery risk low while stabilizing RunPack governance and release flow.
- Action later: schedule a controlled migration task with CI hardening and compatibility verification.
