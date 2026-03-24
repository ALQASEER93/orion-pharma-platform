import fs from 'node:fs';
import path from 'node:path';

const MIN_SECRET_LENGTH = 32;
const WEAK_SECRET_PATTERNS = [
  'changeme',
  'default',
  'example',
  'password',
  'replace',
  'secret',
  'test',
  'sample',
];

export function parseEnvFile(content) {
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = stripWrappingQuotes(value);
  }

  return entries;
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function loadEnvFromFile(envFilePath) {
  const filePath = path.resolve(envFilePath);
  return parseEnvFile(fs.readFileSync(filePath, 'utf8'));
}

export function mergeEnvLayers(...layers) {
  return Object.assign({}, ...layers);
}

export function validateStrongSecret(name, secret) {
  const normalized = secret?.trim();

  if (!normalized) {
    throw new Error(`${name} is required.`);
  }

  if (normalized.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} is too weak; provide at least ${MIN_SECRET_LENGTH} characters.`);
  }

  const lowered = normalized.toLowerCase();
  if (WEAK_SECRET_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    throw new Error(`${name} is too weak; placeholder-style secrets are not allowed.`);
  }

  if (/^(.)\1+$/.test(normalized)) {
    throw new Error(`${name} is too weak; repeated-character secrets are not allowed.`);
  }

  return normalized;
}

export function validateProductionEnv(env) {
  validateStrongSecret('ORION_JWT_SECRET', env.ORION_JWT_SECRET);
  validateStrongSecret('ORION_ENCRYPTION_KEY', env.ORION_ENCRYPTION_KEY);

  const dbUrl = env.ORION_DB_URL?.trim();
  if (!dbUrl) {
    throw new Error('ORION_DB_URL is required.');
  }

  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
    throw new Error('ORION_DB_URL must be a postgres connection string.');
  }

  const publicDomain = env.ORION_PUBLIC_DOMAIN?.trim();
  if (!publicDomain) {
    throw new Error('ORION_PUBLIC_DOMAIN is required.');
  }

  const tlsEmail = env.ORION_TLS_EMAIL?.trim();
  if (!tlsEmail) {
    throw new Error('ORION_TLS_EMAIL is required.');
  }

  return {
    ORION_DB_URL: dbUrl,
    ORION_ENCRYPTION_KEY: env.ORION_ENCRYPTION_KEY.trim(),
    ORION_JWT_SECRET: env.ORION_JWT_SECRET.trim(),
    ORION_PUBLIC_DOMAIN: publicDomain,
    ORION_TLS_EMAIL: tlsEmail,
  };
}

export function getServiceBlock(composeText, serviceName) {
  const match = composeText.match(
    new RegExp(
      `^  ${serviceName}:\\r?\\n([\\s\\S]*?)(?=^  [a-z0-9-]+:\\r?$|^networks:\\r?$|^volumes:\\r?$|\\Z)`,
      'im',
    ),
  );

  if (!match) {
    throw new Error(`Service block "${serviceName}" not found.`);
  }

  return match[0];
}

export function validateProdComposeFile(composeText, caddyfileText) {
  const reverseProxy = getServiceBlock(composeText, 'reverse-proxy');
  const api = getServiceBlock(composeText, 'api');
  const postgres = getServiceBlock(composeText, 'postgres');

  if (!/^\s{4}ports:\r?\n\s{6}- ['"]80:80['"]\r?\n\s{6}- ['"]443:443['"]/m.test(reverseProxy)) {
    throw new Error('reverse-proxy must expose only ports 80 and 443.');
  }

  if (/^\s{4}ports:/m.test(api)) {
    throw new Error('api must not publish ports in docker-compose.prod.yml.');
  }

  if (/^\s{4}ports:/m.test(postgres)) {
    throw new Error('postgres must not publish ports in docker-compose.prod.yml.');
  }

  if (!/^networks:\r?\n  orion_internal:\r?\n    internal: true/m.test(composeText)) {
    throw new Error('docker-compose.prod.yml must define an internal-only network.');
  }

  if (!/http:\/\/\{\$ORION_PUBLIC_DOMAIN\}\s*\{\s*redir https:\/\/\{\$ORION_PUBLIC_DOMAIN\}\{uri\} permanent/m.test(caddyfileText)) {
    throw new Error('Caddyfile must redirect HTTP traffic to HTTPS.');
  }

  if (!/handle \/api\/\* \{\s*reverse_proxy api:3001\s*\}/m.test(caddyfileText)) {
    throw new Error('Caddyfile must proxy /api/* traffic to the API service.');
  }

  if (!/https:\/\/127\.0\.0\.1\/api\/health/.test(composeText)) {
    throw new Error('reverse-proxy healthcheck must probe /api/health over HTTPS.');
  }
}
