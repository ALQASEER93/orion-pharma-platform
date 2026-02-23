import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';

const tenantId = '11111111-1111-1111-1111-111111111111';

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const host = process.env.ORION_DB_HOST ?? 'localhost';
  const port = process.env.ORION_DB_PORT ?? '5432';
  const db = process.env.ORION_DB_NAME ?? 'orion_pharma';
  const user = process.env.ORION_DB_USER ?? 'postgres';
  const password = process.env.ORION_DB_PASSWORD ?? 'postgres';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

describe('Products (e2e smoke)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ensureDatabaseUrl();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('login + list products', async () => {
    const server = app.getHttpServer() as Server;

    const loginResponse = await request(server).post('/api/auth/login').send({
      email: 'admin@orion.local',
      password: 'Admin@123',
      tenantId,
    });

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.access_token).toBeTruthy();

    const productsResponse = await request(server)
      .get('/api/products')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .set('x-tenant-id', tenantId);

    expect(productsResponse.status).toBe(200);
    expect(Array.isArray(productsResponse.body)).toBe(true);
  });
});
