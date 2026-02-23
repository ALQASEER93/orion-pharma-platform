# Run Instructions

## Prerequisites

- Node.js 24+
- Corepack enabled (`corepack pnpm -v`)
- Docker Desktop
- `.env` configured with `ORION_DB_*` values

## Local setup

```bash
corepack pnpm install
docker compose up -d postgres
corepack pnpm db:migrate
corepack pnpm --filter @orion/api prisma:verify
corepack pnpm --filter @orion/api prisma db seed
corepack pnpm --filter @orion/api start:dev
corepack pnpm --filter @orion/web dev
```

## Health check

- API health endpoint: `GET http://localhost:3001/api/health`

## Full quality checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm --filter @orion/api build
corepack pnpm --filter @orion/web build
```

## Docker run

```bash
corepack pnpm dev:up
```

Services:
- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`

## Common devops commands

```bash
corepack pnpm dev:up
corepack pnpm dev:down
corepack pnpm db:migrate
corepack pnpm db:reset
corepack pnpm --filter @orion/api prisma:verify
```

## Prisma roadmap note

- Prisma v7 migration is deferred for a later planned upgrade window.
- Current baseline remains Prisma v6 to keep release risk and infrastructure cost low.
