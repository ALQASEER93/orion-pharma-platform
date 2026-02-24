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
const productAId = '66666666-6666-6666-6666-666666666666';
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

describe('Goods Receipts (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret';
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

  it('creates partial GRN and updates inventory + remaining quantity', async () => {
    const po = await createAndApprovePurchaseOrder(5);

    const response = await request(app.getHttpServer() as Server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId: po.id,
        idempotencyKey: `idem-${Date.now()}-a`,
        lines: [{ purchaseOrderLineId: po.lineId, qtyReceivedNow: 2 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.grnNumber).toMatch(/^GRN-\d{4}-\d{6}$/);
    expect(response.body.totalReceivedQuantity).toBe(2);

    const balance = await prisma.inventoryBalance.findUnique({
      where: {
        tenantId_branchId_productId_batchNo: {
          tenantId,
          branchId,
          productId: productAId,
          batchNo: '',
        },
      },
    });
    expect(balance?.quantity).toBeGreaterThanOrEqual(2);

    const poLine = await prisma.purchaseOrderLine.findUnique({
      where: { id: po.lineId },
      select: { receivedQuantity: true },
    });
    expect(poLine?.receivedQuantity).toBe(2);
  });

  it('rejects over-receipt with 409 conflict', async () => {
    const po = await createAndApprovePurchaseOrder(2);

    const first = await request(app.getHttpServer() as Server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId: po.id,
        idempotencyKey: `idem-${Date.now()}-b1`,
        lines: [{ purchaseOrderLineId: po.lineId, qtyReceivedNow: 2 }],
      });

    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer() as Server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId: po.id,
        idempotencyKey: `idem-${Date.now()}-b2`,
        lines: [{ purchaseOrderLineId: po.lineId, qtyReceivedNow: 1 }],
      });

    expect(second.status).toBe(409);
  });

  it('allows only one of two parallel receipts on last remaining qty', async () => {
    const po = await createAndApprovePurchaseOrder(1);
    const server = app.getHttpServer() as Server;

    const reqA = request(server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId: po.id,
        idempotencyKey: `idem-${Date.now()}-c1`,
        lines: [{ purchaseOrderLineId: po.lineId, qtyReceivedNow: 1 }],
      });

    const reqB = request(server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId: po.id,
        idempotencyKey: `idem-${Date.now()}-c2`,
        lines: [{ purchaseOrderLineId: po.lineId, qtyReceivedNow: 1 }],
      });

    const [a, b] = await Promise.all([reqA, reqB]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);

    const poLine = await prisma.purchaseOrderLine.findUnique({
      where: { id: po.lineId },
      select: { quantity: true, receivedQuantity: true },
    });

    expect(poLine?.receivedQuantity).toBeLessThanOrEqual(poLine?.quantity ?? 0);
  });

  async function createAndApprovePurchaseOrder(quantity: number) {
    const poCreate = await request(app.getHttpServer() as Server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        supplierId,
        lines: [{ productId: productAId, quantity, unitPrice: 10 }],
      });

    expect(poCreate.status).toBe(201);
    const poId = poCreate.body.id as string;
    const poLineId = (poCreate.body.lines as Array<{ id: string }>)[0].id;

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: PurchaseOrderStatus.APPROVED },
    });

    return { id: poId, lineId: poLineId };
  }
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

  const permissionKeys = [
    'purchase_orders.read',
    'purchase_orders.manage',
    'goods_receipts.read',
    'goods_receipts.manage',
  ];

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
