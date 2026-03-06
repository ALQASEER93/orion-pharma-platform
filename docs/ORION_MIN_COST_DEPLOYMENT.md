# ORION Pharma Minimal-Cost Deployment

## Scope
- Target: single VPS deployment with Docker Compose.
- Goal: satisfy `DEP-P0-001`, `DEP-P0-002`, and `DEP-P0-003` with minimal infrastructure.
- Constraint: no public API or database port exposure; TLS terminates at the reverse proxy only.

## Architecture
```text
Internet
  |
  | 80/443
  v
[reverse-proxy: Caddy]
  |-- /api/* --> [api]
  |-- /* ------> [web]
                 |
                 v
             [postgres]

Published to host:
- reverse-proxy: 80, 443

Internal-only Docker network:
- reverse-proxy
- api
- web
- postgres
```

## Monthly Cost Estimate
- VPS: 2 vCPU / 4 GB RAM / 80 GB SSD: USD 20-30 / month
- Off-host object storage for backups: USD 5-10 / month
- Domain name: USD 1-2 / month averaged annually
- Total baseline: USD 26-42 / month

## Required Production Environment
- `ORION_PUBLIC_DOMAIN`
- `ORION_TLS_EMAIL`
- `ORION_DB_URL`
- `ORION_DB_NAME`
- `ORION_DB_USER`
- `ORION_DB_PASSWORD`
- `ORION_JWT_SECRET`
- `ORION_ENCRYPTION_KEY`

Rules:
- Use ORION-prefixed variables only.
- `ORION_DB_URL` must be PostgreSQL and should target `postgres:5432` inside Compose.
- `ORION_JWT_SECRET` and `ORION_ENCRYPTION_KEY` must be at least 32 characters and must not be placeholders.

## Deploy Steps
1. Copy `.env.example` to `.env.production` and fill only ORION-prefixed production values.
2. Run `node scripts/deploy-check.mjs --env-file .env.production`.
3. Build and start production services:
   `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
4. Verify service status:
   `docker compose -f docker-compose.prod.yml ps`
5. Verify TLS edge:
   `curl -I http://your-domain.example`
   Expected: `301/308` redirect to `https://...`
6. Verify API health behind TLS:
   `curl https://your-domain.example/api/health`
   Expected JSON: `{"status":"ok"}`

## Rollback Steps
1. Keep the previous image set and `.env.production` backup before each deploy.
2. If the new release fails, stop the stack:
   `docker compose -f docker-compose.prod.yml --env-file .env.production down`
3. Revert the application image tag or git revision used for the previous known-good release.
4. Start the prior release:
   `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`
5. Re-check:
   `curl https://your-domain.example/api/health`

## Backup
- Script: `scripts/backup-db.sh`
- Format: PostgreSQL custom dump via `pg_dump`
- Local output default: `./backups/orion_db_<timestamp>.dump`

Example local backup:
```sh
ORION_DB_URL='postgresql://postgres:***@postgres:5432/orion?schema=public' \
./scripts/backup-db.sh
```

Example S3-compatible upload:
```sh
ORION_DB_URL='postgresql://postgres:***@postgres:5432/orion?schema=public' \
ORION_BACKUP_S3_BUCKET='orion-prod-backups' \
ORION_BACKUP_S3_ENDPOINT='https://s3.example.com' \
./scripts/backup-db.sh
```

Example SFTP upload:
```sh
ORION_DB_URL='postgresql://postgres:***@postgres:5432/orion?schema=public' \
ORION_BACKUP_SFTP_HOST='backup.example.com' \
ORION_BACKUP_SFTP_USER='orion-backup' \
ORION_BACKUP_SFTP_PATH='/srv/backups/orion' \
./scripts/backup-db.sh
```

## Restore Drill
1. Provision a clean PostgreSQL instance.
2. Copy the latest `.dump` artifact from local disk, S3-compatible storage, or SFTP.
3. Restore:
   `pg_restore --clean --if-exists --no-owner --dbname "$ORION_DB_URL" ./backups/orion_db_<timestamp>.dump`
4. Start the application against the restored database.
5. Verify:
   `curl https://your-domain.example/api/health`
6. Record the drill date, source backup file, restore duration, and verification result.

## Guardrails Implemented
- `docker-compose.prod.yml` exposes only the reverse proxy on ports `80` and `443`.
- `api` and `postgres` have no public port bindings.
- HTTP traffic is redirected to HTTPS in `deploy/Caddyfile`.
- Reverse proxy healthcheck probes `https://127.0.0.1/api/health` with the production host header.
- `scripts/deploy-check.mjs` fails deployment when required ORION secrets or DB URL are missing or weak.
