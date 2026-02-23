# ORION Pharma Data Model

Prisma schema is defined in `apps/api/prisma/schema.prisma`.

## Core tables

- `tenants` (`id`, `name`, `subscription_plan`, `created_at`)
- `branches` (`id`, `tenant_id`, `name`, `location`, `created_at`)
- `users` (`id`, `tenant_id`, `branch_id`, `role_id`, `email`, `password_hash`, `is_active`, `created_at`)
- `roles` (`id`, `tenant_id`, `name`)
- `permissions` (`id`, `key`)
- `role_permissions` (`role_id`, `permission_id`)
- `audit_logs` (`id`, `tenant_id`, `user_id`, `action`, `entity`, `entity_id`, `before`, `after`, `created_at`)
- `inventory_balances` (`tenant_id`, `branch_id`, `product_id`, `batch_no`, `quantity`)

## Multi-tenant strategy

- `tenant_id` appears on tenant-owned tables.
- Access control uses JWT tenant claim + request `x-tenant-id` header.
- Role names are unique per tenant (`@@unique([tenantId, name])`).
- Audit records preserve before/after payloads as Prisma `Json`.
- Inventory updates use tenant-scoped atomic balance checks to prevent negative stock races.

## Database provider strategy

- Local default: SQLite (`apps/api/prisma/schema.prisma`)
- Optional PostgreSQL: `apps/api/prisma/schema.postgres.prisma`
- Provider is selected by `ORION_DB_PROVIDER` via `apps/api/scripts/prisma-env.mjs`
