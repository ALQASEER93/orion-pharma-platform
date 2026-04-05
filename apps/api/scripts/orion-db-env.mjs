import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function findRepoRoot(startDir) {
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

function toSqliteUrl(absolutePath) {
  const normalized = absolutePath.replace(/\\/g, '/');
  return `file:${normalized}`;
}

export function loadOrionEnv() {
  const repoRoot = findRepoRoot(process.cwd());
  loadEnvFile(resolve(repoRoot, '.env'));
  loadEnvFile(resolve(process.cwd(), '.env'));
  return { repoRoot };
}

export function getOrionDbProvider() {
  const provider = (process.env.ORION_DB_PROVIDER ?? 'sqlite').toLowerCase();
  return provider === 'postgresql' ? 'postgresql' : 'sqlite';
}

export function resolveOrionDatabaseUrl(repoRoot) {
  if (process.env.ORION_DATABASE_URL) {
    return process.env.ORION_DATABASE_URL;
  }

  if (getOrionDbProvider() === 'postgresql') {
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

  const sqliteDir = resolve(repoRoot, '.orion');
  mkdirSync(sqliteDir, { recursive: true });
  const sqliteFile = process.env.ORION_SQLITE_FILE
    ? resolve(repoRoot, process.env.ORION_SQLITE_FILE)
    : resolve(sqliteDir, 'stage834_local.db');
  return toSqliteUrl(sqliteFile);
}

export function resolvePrismaSchemaPath(repoRoot) {
  if (getOrionDbProvider() === 'postgresql') {
    return resolve(repoRoot, 'apps/api/prisma/schema.postgres.prisma');
  }

  return resolve(repoRoot, 'apps/api/prisma/schema.prisma');
}
