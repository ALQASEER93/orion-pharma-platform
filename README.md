# orion-pharma-platform

ORION PHARMA monorepo (NestJS API + Next.js web).

## Local Development (Docker-less default)

```bash
corepack pnpm install
corepack pnpm dev:prepare
corepack pnpm dev:api
corepack pnpm dev:web
```

- Default DB provider: SQLite
- Default DB file: `.orion/dev.db`

## Optional Docker / PostgreSQL

```bash
corepack pnpm dev:up
corepack pnpm db:migrate
corepack pnpm --filter @orion/api prisma db seed
```

## Docs

- `docs/DEVELOPMENT.md`
- `docs/RUN_INSTRUCTIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
