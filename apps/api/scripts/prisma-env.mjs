import { spawnSync } from 'node:child_process';
import {
  loadOrionEnv,
  resolveOrionDatabaseUrl,
  resolvePrismaSchemaPath,
} from './orion-db-env.mjs';

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new Error('Missing Prisma args. Example: node scripts/prisma-env.mjs migrate dev');
  }

  const { repoRoot } = loadOrionEnv();
  const databaseUrl = resolveOrionDatabaseUrl(repoRoot);
  const schemaPath = resolvePrismaSchemaPath(repoRoot);
  const hasSchemaArg = args.includes('--schema');
  const finalArgs = hasSchemaArg ? args : [...args, '--schema', schemaPath];

  const result = spawnSync('prisma', finalArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ORION_DATABASE_URL: databaseUrl,
    },
  });

  process.exit(result.status ?? 1);
}

main();
