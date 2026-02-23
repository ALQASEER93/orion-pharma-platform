import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const tenantId = '11111111-1111-1111-1111-111111111111';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const branchId = '22222222-2222-2222-2222-222222222222';
const prisma = new PrismaClient();

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
    await ensureAdminFixture();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('login + list products', async () => {
    const server = app.getHttpServer() as Server;

    const loginResponse = await request(server)
      .post('/api/auth/login')
      .send({
        email: 'admin@orion.local',
        password: adminPassword,
        tenantId,
      })
      .set('x-tenant-id', tenantId);

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

async function ensureAdminFixture() {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'ORION Pharma Demo Tenant',
      subscriptionPlan: 'enterprise',
    },
  });

  const role = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'admin',
      },
    },
    update: {},
    create: {
      tenantId,
      name: 'admin',
    },
  });

  const productsReadPermission = await prisma.permission.upsert({
    where: { key: 'products.read' },
    update: {},
    create: { key: 'products.read' },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: role.id,
        permissionId: productsReadPermission.id,
      },
    },
    update: {},
    create: {
      roleId: role.id,
      permissionId: productsReadPermission.id,
    },
  });

  await prisma.branch.upsert({
    where: { id: branchId },
    update: {
      name: 'Main Branch',
      location: 'Riyadh',
      tenantId,
    },
    create: {
      id: branchId,
      tenantId,
      name: 'Main Branch',
      location: 'Riyadh',
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: 'admin@orion.local' },
    update: {
      tenantId,
      branchId,
      roleId: role.id,
      passwordHash,
      isActive: true,
    },
    create: {
      tenantId,
      branchId,
      roleId: role.id,
      email: 'admin@orion.local',
      passwordHash,
      isActive: true,
    },
  });
}
