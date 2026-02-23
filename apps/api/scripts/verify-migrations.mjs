import { spawnSync } from 'node:child_process';
import {
  loadOrionEnv,
  resolveOrionDatabaseUrl,
  resolvePrismaSchemaPath,
} from './orion-db-env.mjs';

const { repoRoot } = loadOrionEnv();
const databaseUrl = resolveOrionDatabaseUrl(repoRoot);
const schemaPath = resolvePrismaSchemaPath(repoRoot);

const result = spawnSync('prisma', ['migrate', 'status', '--schema', schemaPath], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    ORION_DATABASE_URL: databaseUrl,
  },
});

process.exit(result.status ?? 1);
