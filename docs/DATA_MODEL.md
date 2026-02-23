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

## Multi-tenant strategy

- `tenant_id` appears on tenant-owned tables.
- Access control uses JWT tenant claim + request `x-tenant-id` header.
- Role names are unique per tenant (`@@unique([tenantId, name])`).
- Audit records preserve before/after payloads in `jsonb`.

## Block 2 product and inventory

- `therapeutic_classes` (`tenant_id`, `name_ar`, `name_en`)
- `dosage_forms` (`tenant_id`, `name_ar`, `name_en`)
- `storage_conditions` (`tenant_id`, `name_ar`, `name_en`)
- `regulatory_types` (`tenant_id`, `name_ar`, `name_en`)
- `products`
  - Product master data: `name_ar`, `name_en`, `barcode`, `strength`, `pack_size`
  - Tracking behavior: `tracking_mode` (`NONE`, `EXPIRY_ONLY`, `LOT_EXPIRY`)
  - Optional taxonomy references to class/form/storage/regulatory type
- `inventory_movements`
  - Immutable stock ledger entries with signed `quantity`
  - Scope keys: `tenant_id`, `branch_id`, `product_id`, optional `batch_no`, `expiry_date`
  - Event type: `IN`, `OUT`, `ADJUSTMENT`

## Stock-on-hand model

- Stock on hand is produced as a query/view over `inventory_movements` grouped by:
  - `branch_id`
  - `product_id`
  - `batch_no` (for tracked batches)
- Negative stock is prevented unless user has `inventory.override_negative`.
