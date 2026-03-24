import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  loadEnvFromFile,
  mergeEnvLayers,
  validateProductionEnv,
  validateProdComposeFile,
} from './lib/deploy-guardrails.mjs';

function resolveArg(flagName) {
  const index = process.argv.indexOf(flagName);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const envFile = resolveArg('--env-file') ?? path.join(repoRoot, '.env.production');
  const envFromFile = loadEnvFromFile(envFile);
  const mergedEnv = mergeEnvLayers(envFromFile, process.env);

  validateProductionEnv(mergedEnv);

  const composePath = path.join(repoRoot, 'docker-compose.prod.yml');
  const caddyfilePath = path.join(repoRoot, 'deploy', 'Caddyfile');
  const composeText = fs.readFileSync(composePath, 'utf8');
  const caddyfileText = fs.readFileSync(caddyfilePath, 'utf8');

  validateProdComposeFile(composeText, caddyfileText);

  console.log(`deploy-check passed using ${path.relative(repoRoot, envFile)}`);
}

main();
