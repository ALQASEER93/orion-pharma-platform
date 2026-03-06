import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const otherTenantId = '99999999-9999-9999-9999-999999999999';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const branchId = '22222222-2222-2222-2222-222222222222';
let prisma: PrismaClient;

function ensureDatabaseUrl() {
  if (process.env.ORION_DATABASE_URL) {
    return;
  }

  const provider = (process.env.ORION_DB_PROVIDER ?? 'sqlite').toLowerCase();
  if (provider === 'postgresql') {
    const host = process.env.ORION_DB_HOST ?? 'localhost';
    const port = process.env.ORION_DB_PORT ?? '5432';
    const db = process.env.ORION_DB_NAME ?? 'orion_pharma';
    const user = process.env.ORION_DB_USER ?? 'postgres';
    const password = process.env.ORION_DB_PASSWORD ?? 'postgres';
    process.env.ORION_DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
    return;
  }

  process.env.ORION_DATABASE_URL = resolveOrionDatabaseUrl();
}

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let otherTenantCustomerId = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret_value_123456';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    otherTenantCustomerId = await ensureFixture();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const loginResponse = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({
        email: 'admin@orion.local',
        password: adminPassword,
        tenantId,
      })
      .set('x-tenant-id', tenantId);

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.access_token).toBeTruthy();
    accessToken = loginResponse.body.access_token as string;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('create -> list -> get -> update customer in tenant', async () => {
    const server = app.getHttpServer() as Server;
    const suffix = Date.now().toString();

    const createResponse = await request(server)
      .post('/api/customers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        name: `Customer ${suffix}`,
        phone: `+96650000${suffix.slice(-4)}`,
        email: `customer-${suffix}@orion.local`,
        address: 'Riyadh',
        notes: 'Initial note',
      });
    expect(createResponse.status).toBe(201);

    const createdId = (createResponse.body as { id: string }).id;
    expect(createdId).toBeTruthy();

    const listResponse = await request(server)
      .get('/api/customers')
      .query({ q: suffix })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(listResponse.status).toBe(200);
    expect(
      (listResponse.body as Array<{ id: string }>).some(
        (item) => item.id === createdId,
      ),
    ).toBe(true);
    expect(
      (listResponse.body as Array<{ id: string }>).some(
        (item) => item.id === otherTenantCustomerId,
      ),
    ).toBe(false);

    const detailResponse = await request(server)
      .get(`/api/customers/${createdId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.id).toBe(createdId);

    const updateResponse = await request(server)
      .patch(`/api/customers/${createdId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        name: `Customer ${suffix} Updated`,
        notes: 'Updated note',
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.name).toContain('Updated');
    expect(updateResponse.body.notes).toBe('Updated note');
  });

  it('returns 404 for cross-tenant customer access', async () => {
    const server = app.getHttpServer() as Server;

    const crossTenantGet = await request(server)
      .get(`/api/customers/${otherTenantCustomerId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(crossTenantGet.status).toBe(404);

    const crossTenantPatch = await request(server)
      .patch(`/api/customers/${otherTenantCustomerId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ name: 'Should not update' });
    expect(crossTenantPatch.status).toBe(404);
  });
});

async function ensureFixture() {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'ORION Pharma Demo Tenant',
      subscriptionPlan: 'enterprise',
    },
  });

  await prisma.tenant.upsert({
    where: { id: otherTenantId },
    update: {},
    create: {
      id: otherTenantId,
      name: 'ORION Other Tenant',
      subscriptionPlan: 'basic',
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

  const permissionKeys = ['customers.read', 'customers.manage'];
  for (const key of permissionKeys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  await prisma.branch.upsert({
    where: { id: branchId },
    update: {
      tenantId,
      name: 'Main Branch',
      location: 'Riyadh',
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

  const otherTenantCustomer = await prisma.customer.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000999' },
    update: {
      tenantId: otherTenantId,
      name: 'Other Tenant Customer',
      phone: '+966599999999',
      email: 'other-customer@orion.local',
      address: 'Jeddah',
    },
    create: {
      id: 'c0000000-0000-0000-0000-000000000999',
      tenantId: otherTenantId,
      name: 'Other Tenant Customer',
      phone: '+966599999999',
      email: 'other-customer@orion.local',
      address: 'Jeddah',
    },
  });

  return otherTenantCustomer.id;
}
