import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

describe('Startup guard (e2e)', () => {
  const originalSecret = process.env.ORION_JWT_SECRET;
  const originalDbUrl = process.env.ORION_DATABASE_URL;

  beforeAll(() => {
    process.env.ORION_DATABASE_URL =
      process.env.ORION_DATABASE_URL ?? resolveOrionDatabaseUrl();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ORION_JWT_SECRET;
    } else {
      process.env.ORION_JWT_SECRET = originalSecret;
    }

    if (originalDbUrl === undefined) {
      delete process.env.ORION_DATABASE_URL;
    } else {
      process.env.ORION_DATABASE_URL = originalDbUrl;
    }
  });

  it('refuses to boot when ORION_JWT_SECRET is missing', async () => {
    delete process.env.ORION_JWT_SECRET;

    await expect(
      Test.createTestingModule({
        imports: [AppModule],
      }).compile(),
    ).rejects.toThrow('ORION_JWT_SECRET is required');
  });

  it('refuses to boot when ORION_JWT_SECRET is weak', async () => {
    process.env.ORION_JWT_SECRET = 'weak-secret';

    await expect(
      Test.createTestingModule({
        imports: [AppModule],
      }).compile(),
    ).rejects.toThrow('ORION_JWT_SECRET is too weak');
  });
});
