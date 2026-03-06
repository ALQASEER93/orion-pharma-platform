const MIN_SECRET_LENGTH = 32;

export function validateOrionJwtSecret(secret: string | undefined): string {
  const normalized = secret?.trim();

  if (!normalized) {
    throw new Error(
      'ORION_JWT_SECRET is required and must be at least 32 characters long.',
    );
  }

  if (normalized.length < MIN_SECRET_LENGTH) {
    throw new Error(
      'ORION_JWT_SECRET is too weak; provide at least 32 characters.',
    );
  }

  return normalized;
}

export function resolveJwtSecret(): string {
  return validateOrionJwtSecret(process.env.ORION_JWT_SECRET);
}
