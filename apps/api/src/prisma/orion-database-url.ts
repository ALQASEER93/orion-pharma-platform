import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function findRepoRoot(startDir: string): string {
  let current = startDir;

  while (true) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return startDir;
    }

    current = parent;
  }
}

function toSqliteUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/');
  return `file:${normalized}`;
}

function resolvePostgresUrl(): string {
  const host = process.env.ORION_DB_HOST ?? 'localhost';
  const port = process.env.ORION_DB_PORT ?? '5432';
  const db = process.env.ORION_DB_NAME;
  const user = process.env.ORION_DB_USER;
  const password = process.env.ORION_DB_PASSWORD;

  if (!db || !user || !password) {
    throw new Error(
      'Missing Postgres env. Set ORION_DATABASE_URL or ORION_DB_NAME/ORION_DB_USER/ORION_DB_PASSWORD.',
    );
  }

  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

export function resolveOrionDatabaseUrl(): string {
  if (process.env.ORION_DATABASE_URL) {
    return process.env.ORION_DATABASE_URL;
  }

  const provider = (process.env.ORION_DB_PROVIDER ?? 'sqlite').toLowerCase();
  if (provider === 'postgresql') {
    return resolvePostgresUrl();
  }

  const repoRoot = findRepoRoot(process.cwd());
  const sqliteDir = resolve(repoRoot, '.orion');
  mkdirSync(sqliteDir, { recursive: true });
  const sqliteFile = process.env.ORION_SQLITE_FILE
    ? resolve(repoRoot, process.env.ORION_SQLITE_FILE)
    : resolve(sqliteDir, 'stage834_local.db');
  return toSqliteUrl(sqliteFile);
}
