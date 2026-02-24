# Run Instructions

## Prerequisites

- Node.js 24+
- Corepack enabled (`corepack pnpm -v`)
- `.env` configured from `.env.example`

## Docker-less Quickstart (Default)

```bash
corepack pnpm install
corepack pnpm dev:prepare
corepack pnpm dev:api
corepack pnpm dev:web
```

Default local database is SQLite at `.orion/dev.db`.

## Optional PostgreSQL (Docker)

Set these in `.env`:

```bash
ORION_DB_PROVIDER=postgresql
ORION_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orion_pharma?schema=public
```

Then run:

```bash
corepack pnpm dev:up
corepack pnpm db:migrate
corepack pnpm --filter @orion/api prisma db seed
```

## Health check

- API health endpoint: `GET http://localhost:3001/api/health`

## Full quality checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## RunPack evidence

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/runpack.ps1
```

RunPack evidence is written only under `docs/_runs`:
- `docs/_runs/run_<ts>/` (logs, artifacts, json)
- `docs/_runs/run_<ts>.zip`
- `docs/_runs/run_<ts>_logs.zip`
- `docs/_runs/run_<ts>_advisor.zip`
- `docs/_runs/LATEST.txt`

`docs_runs` (without underscore) is a legacy path and is blocked by RunPack guardrails.

Optional Docker validation in RunPack:

```bash
$env:ORION_RUNPACK_USE_DOCKER = "1"
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/runpack.ps1
```
