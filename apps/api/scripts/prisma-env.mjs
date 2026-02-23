import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

loadEnvFile(resolve(process.cwd(), '../../.env'));
loadEnvFile(resolve(process.cwd(), '.env'));

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.ORION_DB_HOST ?? 'localhost';
  const port = process.env.ORION_DB_PORT ?? '5432';
  const db = process.env.ORION_DB_NAME;
  const user = process.env.ORION_DB_USER;
  const password = process.env.ORION_DB_PASSWORD;

  if (!db || !user || !password) {
    throw new Error(
      'Missing DB env. Set DATABASE_URL or ORION_DB_NAME/ORION_DB_USER/ORION_DB_PASSWORD.',
    );
  }

  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new Error('Missing Prisma args. Example: node scripts/prisma-env.mjs migrate dev');
  }

  const databaseUrl = ensureDatabaseUrl();
  const result = spawnSync('prisma', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  process.exit(result.status ?? 1);
}

main();
