# Authentication and Authorization Flow

1. Client calls `POST /api/auth/login` with `email`, `password`, and `tenantId`.
2. API verifies user status and bcrypt password hash.
3. API verifies tenant context matches user tenant.
4. API signs JWT containing `sub`, `tenantId`, `email`, `role`, `permissions`.
5. Protected endpoints require bearer token (global `JwtAuthGuard`).
6. Permission checks are enforced by `PermissionsGuard` and `@Permissions(...)` decorator.

## Tenant isolation

- `TenantIsolationMiddleware` captures `x-tenant-id` into request context.
- Auth service compares login tenant context against persisted user tenant.
- Controllers/services should always scope data access by `tenantId`.
