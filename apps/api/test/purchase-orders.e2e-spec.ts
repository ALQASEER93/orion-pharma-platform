import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import {
  PrismaClient,
  PurchaseOrderStatus,
  TrackingMode,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const otherTenantId = '99999999-9999-9999-9999-999999999999';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const branchId = '22222222-2222-2222-2222-222222222222';
const supplierId = '44444444-4444-4444-4444-444444444444';
const otherSupplierId = '55555555-5555-5555-5555-555555555555';
const productAId = '66666666-6666-6666-6666-666666666666';
const productBId = '77777777-7777-7777-7777-777777777777';
const otherProductId = '88888888-8888-8888-8888-888888888888';
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

describe('Purchase Orders (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret_value_123456';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    await ensureFixture();
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

  it('creates draft purchase order with immutable tenant sequence number', async () => {
    const server = app.getHttpServer() as Server;

    const firstResponse = await request(server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        supplierId,
        notes: 'First draft PO',
        lines: [
          { productId: productAId, quantity: 2, unitPrice: 12.5 },
          { productId: productBId, quantity: 1, unitPrice: 5 },
        ],
      });

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.status).toBe(PurchaseOrderStatus.DRAFT);
    expect(firstResponse.body.poNumber).toMatch(/^PO-\d{4}-\d{6}$/);
    expect(firstResponse.body.totalQuantity).toBe(3);
    expect(firstResponse.body.totalAmount).toBe(30);

    const secondResponse = await request(server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        supplierId,
        lines: [{ productId: productAId, quantity: 1, unitPrice: 10 }],
      });

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.poNumber).not.toBe(firstResponse.body.poNumber);
  });

  it('lists and fetches details for tenant purchase orders', async () => {
    const server = app.getHttpServer() as Server;

    const listResponse = await request(server)
      .get('/api/purchase-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body.length).toBeGreaterThan(0);

    const firstPoId = (listResponse.body as Array<{ id: string }>)[0].id;
    const detailResponse = await request(server)
      .get(`/api/purchase-orders/${firstPoId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.id).toBe(firstPoId);
    expect(Array.isArray(detailResponse.body.lines)).toBe(true);
  });

  it('rejects cross-tenant supplier and product references', async () => {
    const server = app.getHttpServer() as Server;

    const invalidSupplierResponse = await request(server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        supplierId: otherSupplierId,
        lines: [{ productId: productAId, quantity: 1, unitPrice: 2 }],
      });
    expect(invalidSupplierResponse.status).toBe(400);

    const invalidProductResponse = await request(server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        supplierId,
        lines: [{ productId: otherProductId, quantity: 1, unitPrice: 2 }],
      });
    expect(invalidProductResponse.status).toBe(400);
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

  const permissionKeys = ['purchase_orders.read', 'purchase_orders.manage'];
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

  await prisma.supplier.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: 'SUP-PO-001',
      },
    },
    update: {
      id: supplierId,
      nameAr: 'مورد مشتريات',
      nameEn: 'PO Supplier',
      isActive: true,
    },
    create: {
      id: supplierId,
      tenantId,
      code: 'SUP-PO-001',
      nameAr: 'مورد مشتريات',
      nameEn: 'PO Supplier',
      isActive: true,
    },
  });

  await prisma.supplier.upsert({
    where: {
      tenantId_code: {
        tenantId: otherTenantId,
        code: 'SUP-OTHER-001',
      },
    },
    update: {
      id: otherSupplierId,
      isActive: true,
    },
    create: {
      id: otherSupplierId,
      tenantId: otherTenantId,
      code: 'SUP-OTHER-001',
      nameAr: 'مورد خارجي',
      nameEn: 'Other Supplier',
      isActive: true,
    },
  });

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId,
        barcode: 'PO-PROD-A',
      },
    },
    update: {
      id: productAId,
      nameAr: 'منتج أ',
      nameEn: 'Product A',
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
    create: {
      id: productAId,
      tenantId,
      nameAr: 'منتج أ',
      nameEn: 'Product A',
      barcode: 'PO-PROD-A',
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
  });

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId,
        barcode: 'PO-PROD-B',
      },
    },
    update: {
      id: productBId,
      nameAr: 'منتج ب',
      nameEn: 'Product B',
      strength: '20mg',
      packSize: '20',
      trackingMode: TrackingMode.NONE,
    },
    create: {
      id: productBId,
      tenantId,
      nameAr: 'منتج ب',
      nameEn: 'Product B',
      barcode: 'PO-PROD-B',
      strength: '20mg',
      packSize: '20',
      trackingMode: TrackingMode.NONE,
    },
  });

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId: otherTenantId,
        barcode: 'PO-OTHER-PROD',
      },
    },
    update: {
      id: otherProductId,
      trackingMode: TrackingMode.NONE,
    },
    create: {
      id: otherProductId,
      tenantId: otherTenantId,
      nameAr: 'منتج خارجي',
      nameEn: 'Other Product',
      barcode: 'PO-OTHER-PROD',
      strength: '30mg',
      packSize: '30',
      trackingMode: TrackingMode.NONE,
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
