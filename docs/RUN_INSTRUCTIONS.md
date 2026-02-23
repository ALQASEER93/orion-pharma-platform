# Run Instructions

## Prerequisites

- Node.js 24+
- Corepack enabled (`corepack pnpm -v`)
- Docker Desktop

## Local setup

```bash
corepack pnpm install
docker compose up -d postgres
corepack pnpm --filter @orion/api prisma:migrate --name init_foundation
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
docker compose up --build -d
```

Services:
- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`
