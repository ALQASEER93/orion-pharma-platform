import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaClient, InventoryMovementType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const branchId = '22222222-2222-2222-2222-222222222222';
const productId = '33333333-3333-3333-3333-333333333333';
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

describe('Products (e2e smoke)', () => {
  let app: INestApplication;
  let accessToken = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    await ensureAdminFixture();
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

  it('login + list products', async () => {
    const server = app.getHttpServer() as Server;

    const productsResponse = await request(server)
      .get('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(productsResponse.status).toBe(200);
    expect(Array.isArray(productsResponse.body)).toBe(true);
  });

  it('prevents negative stock atomically under concurrent OUT requests', async () => {
    const server = app.getHttpServer() as Server;
    const uniqueSuffix = Date.now().toString();
    const batchNo = `batch-${uniqueSuffix}`;

    const seedIn = await request(server)
      .post('/api/inventory/movements')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        productId,
        batchNo,
        movementType: InventoryMovementType.IN,
        quantity: 10,
        reason: `seed-${uniqueSuffix}`,
      });
    expect(seedIn.status).toBe(201);

    const payload = {
      branchId,
      productId,
      batchNo,
      movementType: InventoryMovementType.OUT,
      quantity: -7,
      reason: `concurrent-${uniqueSuffix}`,
    };

    const [first, second] = await Promise.all([
      request(server)
        .post('/api/inventory/movements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .send(payload),
      request(server)
        .post('/api/inventory/movements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .send(payload),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const stockResponse = await request(server)
      .get('/api/inventory/stock-on-hand')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .query({ branchId, productId });

    expect(stockResponse.status).toBe(200);
    const currentQty = (
      stockResponse.body as Array<{ quantity: number }>
    ).reduce((sum, row) => sum + row.quantity, 0);
    expect(currentQty).toBeGreaterThanOrEqual(0);
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
  const inventoryAdjustPermission = await prisma.permission.upsert({
    where: { key: 'inventory.adjust' },
    update: {},
    create: { key: 'inventory.adjust' },
  });
  const inventoryReadPermission = await prisma.permission.upsert({
    where: { key: 'inventory.read' },
    update: {},
    create: { key: 'inventory.read' },
  });
  const overrideNegativePermission = await prisma.permission.upsert({
    where: { key: 'inventory.override_negative' },
    update: {},
    create: { key: 'inventory.override_negative' },
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
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: role.id,
      permissionId: overrideNegativePermission.id,
    },
  });
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: role.id,
        permissionId: inventoryAdjustPermission.id,
      },
    },
    update: {},
    create: {
      roleId: role.id,
      permissionId: inventoryAdjustPermission.id,
    },
  });
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: role.id,
        permissionId: inventoryReadPermission.id,
      },
    },
    update: {},
    create: {
      roleId: role.id,
      permissionId: inventoryReadPermission.id,
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
  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId,
        barcode: 'ORION-E2E-001',
      },
    },
    update: {
      id: productId,
      nameAr: 'منتج اختباري',
      nameEn: 'E2E Product',
      strength: '500mg',
      packSize: '10',
      trackingMode: 'NONE',
    },
    create: {
      id: productId,
      tenantId,
      nameAr: 'منتج اختباري',
      nameEn: 'E2E Product',
      barcode: 'ORION-E2E-001',
      strength: '500mg',
      packSize: '10',
      trackingMode: 'NONE',
    },
  });

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
