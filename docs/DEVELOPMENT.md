# Development

## No Docker Quickstart (Default)

Docker is not required for local development.

1. Copy `.env.example` to `.env`.
2. Keep `ORION_DB_PROVIDER=sqlite`.
3. Install dependencies:
   - `corepack pnpm install`
4. Prepare database:
   - `corepack pnpm --filter @orion/api prisma:deploy`
   - `corepack pnpm --filter @orion/api prisma:seed`
5. Start services:
   - API: `corepack pnpm dev:api`
   - Web: `corepack pnpm dev:web`

SQLite local file is created at `.orion/dev.db`.

## Switch to PostgreSQL (Optional)

1. Set `.env` values:
   - `ORION_DB_PROVIDER=postgresql`
   - `ORION_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orion_pharma?schema=public`
2. Use either a hosted PostgreSQL URL or optional local Postgres with Docker Compose:
   - `corepack pnpm dev:up`
3. Apply schema and seed:
   - `corepack pnpm db:migrate`
   - `corepack pnpm --filter @orion/api prisma:seed`

## Troubleshooting (Windows Low Disk)

- Remove old local DB snapshots under `.orion/` when no longer needed.
- Prune Docker only if you use it: `docker system prune -f`.
- Clear pnpm store safely when needed: `corepack pnpm store prune`.

## Validation

Use RunPack for reproducible evidence:

- `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/runpack.ps1`
