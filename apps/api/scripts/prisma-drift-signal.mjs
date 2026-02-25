import { spawnSync } from 'node:child_process';
import { loadOrionEnv, resolvePrismaSchemaPath } from './orion-db-env.mjs';

function run() {
  const { repoRoot } = loadOrionEnv();
  const schemaPath = resolvePrismaSchemaPath(repoRoot);

  const dbUrl = process.env.ORION_DATABASE_URL;
  if (!dbUrl) {
    console.log('drift-signal: skipped (no datasource)');
    process.exit(0);
  }

  const result = spawnSync(
    'prisma',
    ['migrate', 'status', '--schema', schemaPath],
    {
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ORION_DATABASE_URL: dbUrl,
      },
      encoding: 'utf8',
    },
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if ((result.status ?? 1) !== 0) {
    console.log('drift-signal: warning (migrate status non-zero)');
  } else {
    console.log('drift-signal: ok');
  }

  process.exit(0);
}

run();
