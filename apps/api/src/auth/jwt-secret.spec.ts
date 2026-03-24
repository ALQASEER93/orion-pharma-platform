import { resolveJwtSecret, validateOrionJwtSecret } from './jwt-secret';

describe('jwt-secret', () => {
  const originalSecret = process.env.ORION_JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ORION_JWT_SECRET;
      return;
    }

    process.env.ORION_JWT_SECRET = originalSecret;
  });

  it('accepts a strong ORION_JWT_SECRET', () => {
    expect(
      validateOrionJwtSecret('ORION_super_strong_secret_value_123456'),
    ).toBe('ORION_super_strong_secret_value_123456');
  });

  it('rejects a missing ORION_JWT_SECRET', () => {
    expect(() => validateOrionJwtSecret(undefined)).toThrow(
      'ORION_JWT_SECRET is required',
    );
  });

  it('rejects a weak ORION_JWT_SECRET', () => {
    expect(() => validateOrionJwtSecret('short-secret')).toThrow(
      'ORION_JWT_SECRET is too weak',
    );
  });

  it('resolves ORION_JWT_SECRET from env only', () => {
    process.env.ORION_JWT_SECRET = 'ORION_env_secret_value_123456789012';

    expect(resolveJwtSecret()).toBe('ORION_env_secret_value_123456789012');
  });
});
