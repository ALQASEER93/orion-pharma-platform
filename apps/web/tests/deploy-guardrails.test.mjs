import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import {
  getServiceBlock,
  parseEnvFile,
  validateProdComposeFile,
  validateProductionEnv,
} from '../../../scripts/lib/deploy-guardrails.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

test('deploy-check requires ORION_JWT_SECRET, ORION_DB_URL, and ORION_ENCRYPTION_KEY', () => {
  assert.throws(
    () =>
      validateProductionEnv({
        ORION_PUBLIC_DOMAIN: 'orion.example.com',
        ORION_TLS_EMAIL: 'ops@example.com',
      }),
    /ORION_JWT_SECRET is required/,
  );

  assert.throws(
    () =>
      validateProductionEnv({
        ORION_JWT_SECRET: 'ORION_super_strong_signing_value_123456',
        ORION_PUBLIC_DOMAIN: 'orion.example.com',
        ORION_TLS_EMAIL: 'ops@example.com',
      }),
    /ORION_ENCRYPTION_KEY is required/,
  );

  assert.throws(
    () =>
      validateProductionEnv({
        ORION_JWT_SECRET: 'ORION_super_strong_signing_value_123456',
        ORION_ENCRYPTION_KEY: 'ORION_encryption_material_value_123456789',
        ORION_PUBLIC_DOMAIN: 'orion.example.com',
        ORION_TLS_EMAIL: 'ops@example.com',
      }),
    /ORION_DB_URL is required/,
  );
});

test('deploy-check rejects weak placeholder secrets and non-postgres DB URLs', () => {
  assert.throws(
    () =>
      validateProductionEnv({
        ORION_JWT_SECRET: 'default-secret-default-secret-1234',
        ORION_ENCRYPTION_KEY: 'ORION_encryption_material_value_123456789',
        ORION_DB_URL: 'postgresql://postgres:postgres@postgres:5432/orion?schema=public',
        ORION_PUBLIC_DOMAIN: 'orion.example.com',
        ORION_TLS_EMAIL: 'ops@example.com',
      }),
    /ORION_JWT_SECRET is too weak/,
  );

  assert.throws(
    () =>
      validateProductionEnv({
        ORION_JWT_SECRET: 'ORION_super_strong_signing_value_123456',
        ORION_ENCRYPTION_KEY: 'ORION_encryption_material_value_123456789',
        ORION_DB_URL: 'sqlite:///tmp/orion.db',
        ORION_PUBLIC_DOMAIN: 'orion.example.com',
        ORION_TLS_EMAIL: 'ops@example.com',
      }),
    /ORION_DB_URL must be a postgres connection string/,
  );
});

test('production compose keeps api and postgres internal-only and healthchecks TLS edge', () => {
  const composeText = fs.readFileSync(path.join(repoRoot, 'docker-compose.prod.yml'), 'utf8');
  const caddyfileText = fs.readFileSync(path.join(repoRoot, 'deploy', 'Caddyfile'), 'utf8');

  assert.doesNotThrow(() => validateProdComposeFile(composeText, caddyfileText));
  assert.ok(!/^\s{4}ports:/m.test(getServiceBlock(composeText, 'api')));
  assert.ok(!/^\s{4}ports:/m.test(getServiceBlock(composeText, 'postgres')));
});

test('env parser preserves ORION_ variables from production env files', () => {
  const parsed = parseEnvFile(`
    ORION_JWT_SECRET="ORION_super_strong_signing_value_123456"
    ORION_DB_URL=postgresql://postgres:postgres@postgres:5432/orion?schema=public
    ORION_ENCRYPTION_KEY='ORION_encryption_material_value_123456789'
  `);

  assert.equal(parsed.ORION_JWT_SECRET, 'ORION_super_strong_signing_value_123456');
  assert.equal(
    parsed.ORION_DB_URL,
    'postgresql://postgres:postgres@postgres:5432/orion?schema=public',
  );
  assert.equal(parsed.ORION_ENCRYPTION_KEY, 'ORION_encryption_material_value_123456789');
});
