import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from './../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_app_e2e_secret_value_1234567890';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwtService = new JwtService({
      secret: process.env.ORION_JWT_SECRET,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    const server = app.getHttpServer() as Server;
    return request(server)
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('returns deterministic 401 JSON when auth context is missing role', async () => {
    const server = app.getHttpServer() as Server;
    const token = await jwtService.signAsync({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@orion.local',
      permissions: ['products.read'],
    });

    const response = await request(server)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', 'tenant-1');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Authenticated user missing role context.',
      error: 'Unauthorized',
    });
  });
});
