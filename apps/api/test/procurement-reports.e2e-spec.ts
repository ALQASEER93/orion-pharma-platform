import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import {
  PrismaClient,
  PurchaseOrderStatus,
  TrackingMode,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const branchId = '22222222-2222-2222-2222-222222222222';
const supplierId = '87777777-7777-7777-7777-777777777777';
const productAId = '89999999-9999-9999-9999-999999999999';
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

describe('Procurement Reports (e2e)', () => {
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

  it('returns procurement summaries and csv exports for PO -> GRN -> return flow', async () => {
    const purchaseOrder = await createApprovedPo(5, 12.5);
    const goodsReceipt = await createGoodsReceipt(purchaseOrder.lineId, 5);
    await createPurchaseReturn(
      goodsReceipt.goodsReceiptId,
      goodsReceipt.goodsReceiptLineId,
      2,
    );

    const poSummary = await request(app.getHttpServer() as Server)
      .get('/api/reports/procurement/purchase-orders')
      .query({ supplierId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(poSummary.status).toBe(200);
    expect(poSummary.body.totals.orders).toBeGreaterThan(0);
    expect(poSummary.body.totals.totalValue).toBeGreaterThanOrEqual(62.5);

    const grnSummary = await request(app.getHttpServer() as Server)
      .get('/api/reports/procurement/goods-receipts')
      .query({ supplierId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(grnSummary.status).toBe(200);
    expect(grnSummary.body.totals.receipts).toBeGreaterThan(0);
    expect(grnSummary.body.totals.totalQuantity).toBeGreaterThanOrEqual(5);

    const returnsSummary = await request(app.getHttpServer() as Server)
      .get('/api/reports/procurement/purchase-returns')
      .query({ supplierId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(returnsSummary.status).toBe(200);
    expect(returnsSummary.body.totals.returns).toBeGreaterThan(0);
    expect(returnsSummary.body.totals.totalQuantity).toBeGreaterThanOrEqual(2);

    const movementSummary = await request(app.getHttpServer() as Server)
      .get('/api/reports/procurement/inventory-movements')
      .query({ supplierId, page: 1, pageSize: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(movementSummary.status).toBe(200);
    expect(Array.isArray(movementSummary.body.rows)).toBe(true);
    expect(movementSummary.body.rows.length).toBeGreaterThan(0);
    expect(
      movementSummary.body.rows.some(
        (row: { source: string }) => row.source === 'GRN',
      ),
    ).toBe(true);
    expect(
      movementSummary.body.rows.some(
        (row: { source: string }) => row.source === 'RETURN',
      ),
    ).toBe(true);

    const poCsv = await request(app.getHttpServer() as Server)
      .get('/api/reports/procurement/purchase-orders.csv')
      .query({ supplierId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(poCsv.status).toBe(200);
    expect(poCsv.headers['content-type']).toContain('text/csv');
    expect(poCsv.text).toContain('poNumber');

    const grnCsv = await request(app.getHttpServer() as Server)
      .get('/api/reports/procurement/goods-receipts.csv')
      .query({ supplierId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(grnCsv.status).toBe(200);
    expect(grnCsv.text).toContain('grnNumber');

    const returnsCsv = await request(app.getHttpServer() as Server)
      .get('/api/reports/procurement/purchase-returns.csv')
      .query({ supplierId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(returnsCsv.status).toBe(200);
    expect(returnsCsv.text).toContain('returnNumber');
  });

  async function createApprovedPo(quantity: number, unitPrice: number) {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        supplierId,
        lines: [{ productId: productAId, quantity, unitPrice }],
      });

    expect(response.status).toBe(201);
    const poId = response.body.id as string;
    const lineId = (response.body.lines as Array<{ id: string }>)[0].id;

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: PurchaseOrderStatus.APPROVED },
    });

    return { id: poId, lineId };
  }

  async function createGoodsReceipt(
    purchaseOrderLineId: string,
    qtyReceivedNow: number,
  ) {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId: (
          await prisma.purchaseOrderLine.findUniqueOrThrow({
            where: { id: purchaseOrderLineId },
            select: { purchaseOrderId: true },
          })
        ).purchaseOrderId,
        idempotencyKey: `grn-report-${Date.now()}`,
        lines: [
          {
            purchaseOrderLineId,
            qtyReceivedNow,
            batchNo: `RPT-B-${Date.now()}`,
            expiryDate: '2031-12-31T00:00:00.000Z',
          },
        ],
      });

    expect(response.status).toBe(201);
    return {
      goodsReceiptId: response.body.id as string,
      goodsReceiptLineId: (response.body.lines as Array<{ id: string }>)[0].id,
    };
  }

  async function createPurchaseReturn(
    goodsReceiptId: string,
    goodsReceiptLineId: string,
    qtyReturnNow: number,
  ) {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId,
        idempotencyKey: `pr-report-${Date.now()}`,
        lines: [{ goodsReceiptLineId, qtyReturnNow }],
      });

    expect(response.status).toBe(201);
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
    'purchase_returns.read',
    'purchase_returns.manage',
    'inventory.read',
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
        code: 'SUP-RPT-001',
      },
    },
    update: {
      id: supplierId,
      nameAr: 'مورد التقارير',
      nameEn: 'Reports Supplier',
      isActive: true,
    },
    create: {
      id: supplierId,
      tenantId,
      code: 'SUP-RPT-001',
      nameAr: 'مورد التقارير',
      nameEn: 'Reports Supplier',
      isActive: true,
    },
  });

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId,
        barcode: 'RPT-PROD-A',
      },
    },
    update: {
      id: productAId,
      nameAr: 'منتج تقارير أ',
      nameEn: 'Reports Product A',
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.LOT_EXPIRY,
    },
    create: {
      id: productAId,
      tenantId,
      nameAr: 'منتج تقارير أ',
      nameEn: 'Reports Product A',
      barcode: 'RPT-PROD-A',
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.LOT_EXPIRY,
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
