# orion-pharma-platform

ORION PHARMA monorepo (NestJS API + Next.js web).

## Local Development (Docker-less default)

```bash
corepack pnpm install
corepack pnpm --filter @orion/api prisma:deploy
corepack pnpm --filter @orion/api prisma:seed
corepack pnpm dev:api
corepack pnpm dev:web
```

- Docker is not required for local development.
- Default DB provider: SQLite
- Default DB file: `.orion/dev.db`
- Auth token signing/verification uses `ORION_JWT_SECRET` (legacy `JWT_SECRET` fallback only when ORION var is absent).

## Optional Docker / PostgreSQL

```bash
corepack pnpm dev:up
corepack pnpm db:migrate
corepack pnpm --filter @orion/api prisma:seed
```

You can also point `ORION_DATABASE_URL` to a hosted PostgreSQL instance without using Docker.

## Docs

- `docs/DEVELOPMENT.md`
- `docs/RUN_INSTRUCTIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
