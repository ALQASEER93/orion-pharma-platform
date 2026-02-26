# RunPack Report

## Project
- ORION PHARMA

## Run Metadata
- Run timestamp: 2026-02-26T05:46:07.3143502+03:00
- Run name: run_20260226_054458
- Branch: codex/block-5-s7-close-and-statements
- Commit: 6b9f74d7190830f1a1e655c9768b8a2f1d89bcbc
- Node: v24.12.0
- pnpm: 10.6.1

## Prisma
- Provider: sqlite
- ORION_DATABASE_URL: (auto sqlite in .orion/dev.db)
- prisma:generate exit: 0
- prisma:deploy exit: 0
- prisma seed exit: 0

## Validation
- lint exit: 0
- typecheck exit: 0
- test exit: 0
- api e2e exit: 0
- build exit: 0

## Docker
- mode: skipped (dockerless default)

## How To Run Without Docker
1. Configure `.env` from `.env.example` (keep `ORION_DB_PROVIDER=sqlite`).
2. Run `corepack pnpm install`.
3. Run `corepack pnpm --filter @orion/api prisma:deploy` then `corepack pnpm --filter @orion/api prisma:seed`.
4. Start API: `corepack pnpm --filter @orion/api start:dev`.
5. Start Web: `corepack pnpm --filter @orion/web dev`.

## Risks / Follow-ups
- PostgreSQL remains optional via `ORION_DB_PROVIDER=postgresql` and `ORION_DATABASE_URL` override.
- If running with Postgres, use the Postgres Prisma schema path through `prisma-env` helper.

## Result
- overall: passed
- blockers:
- none
