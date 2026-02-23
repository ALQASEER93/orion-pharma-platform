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

## Block 2 additions

- New API modules:
  - `taxonomy` for tenant-scoped product taxonomy master data
  - `products` for product CRUD and tracking mode configuration
  - `inventory` for immutable movement ledger and stock-on-hand queries
- New RBAC permissions:
  - `products.read`, `products.manage`
  - `inventory.read`, `inventory.adjust`, `inventory.override_negative`
- Inventory design:
  - Write path is append-only to `inventory_movements`
  - Read path derives stock-on-hand by grouped aggregation (branch/product/batch)
  - Negative stock validation runs before movement persistence unless privileged override
- Web additions:
  - `/products` page for search/create/edit
  - `/stock` page for stock-on-hand visibility
