import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import {
  InventoryMovementType,
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
const supplierId = '84444444-4444-4444-4444-444444444444';
const productAId = '86666666-6666-6666-6666-666666666666';
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

describe('Purchase Returns (e2e)', () => {
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

  it('creates partial purchase return against GRN line and decrements inventory', async () => {
    const receipt = await createApprovedPoAndReceipt(5);
    const before = await getCurrentBalance(receipt.batchNo);

    const response = await request(app.getHttpServer() as Server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey: `pr-idem-${Date.now()}-a`,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 2 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.returnNumber).toMatch(/^PRN-\d{4}-\d{6}$/);
    expect(response.body.totalQuantityReturned).toBe(2);

    const after = await getCurrentBalance(receipt.batchNo);
    expect(after).toBe(before - 2);
  });

  it('returns same response on idempotent replay with no double decrement', async () => {
    const receipt = await createApprovedPoAndReceipt(2);
    const before = await getCurrentBalance(receipt.batchNo);
    const idempotencyKey = `pr-idem-${Date.now()}-b`;

    const first = await request(app.getHttpServer() as Server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 1 },
        ],
      });

    const second = await request(app.getHttpServer() as Server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 1 },
        ],
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const after = await getCurrentBalance(receipt.batchNo);
    expect(after).toBe(before - 1);
  });

  it('rejects over-return with 409', async () => {
    const receipt = await createApprovedPoAndReceipt(2);

    const first = await request(app.getHttpServer() as Server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey: `pr-idem-${Date.now()}-c1`,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 2 },
        ],
      });

    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer() as Server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey: `pr-idem-${Date.now()}-c2`,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 1 },
        ],
      });

    expect(second.status).toBe(409);
  });

  it('rejects return with 409 when stock is insufficient', async () => {
    const receipt = await createApprovedPoAndReceipt(2);

    const drain = await request(app.getHttpServer() as Server)
      .post('/api/inventory/movements')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        productId: productAId,
        batchNo: receipt.batchNo,
        expiryDate: '2030-12-31T00:00:00.000Z',
        movementType: InventoryMovementType.OUT,
        quantity: -2,
        reason: `drain-${Date.now()}`,
      });
    expect(drain.status).toBe(201);

    const response = await request(app.getHttpServer() as Server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey: `pr-idem-${Date.now()}-d`,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 1 },
        ],
      });

    expect(response.status).toBe(409);
  });

  it('allows only one of two parallel returns on last remaining quantity', async () => {
    const receipt = await createApprovedPoAndReceipt(1);
    const server = app.getHttpServer() as Server;

    const reqA = request(server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey: `pr-idem-${Date.now()}-e1`,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 1 },
        ],
      });

    const reqB = request(server)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        goodsReceiptId: receipt.goodsReceiptId,
        idempotencyKey: `pr-idem-${Date.now()}-e2`,
        lines: [
          { goodsReceiptLineId: receipt.goodsReceiptLineId, qtyReturnNow: 1 },
        ],
      });

    const [a, b] = await Promise.all([reqA, reqB]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);
  });

  async function createApprovedPoAndReceipt(quantity: number) {
    const batchNo = `BATCH-${Date.now()}`;
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

    const grnCreate = await request(app.getHttpServer() as Server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId: poId,
        idempotencyKey: `grn-idem-${Date.now()}`,
        lines: [
          {
            purchaseOrderLineId: poLineId,
            qtyReceivedNow: quantity,
            batchNo,
            expiryDate: '2030-12-31T00:00:00.000Z',
          },
        ],
      });

    expect(grnCreate.status).toBe(201);

    const goodsReceiptLineId = (
      grnCreate.body.lines as Array<{ id: string }>
    )[0].id;

    return {
      goodsReceiptId: grnCreate.body.id as string,
      goodsReceiptLineId,
      batchNo,
    };
  }

  async function getCurrentBalance(batchNo: string) {
    const balance = await prisma.inventoryBalance.findUnique({
      where: {
        tenantId_branchId_productId_batchNo: {
          tenantId,
          branchId,
          productId: productAId,
          batchNo,
        },
      },
      select: {
        quantity: true,
      },
    });

    return balance?.quantity ?? 0;
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
    'inventory.adjust',
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
        code: 'SUP-PR-001',
      },
    },
    update: {
      id: supplierId,
      nameAr: 'مورد مرتجعات',
      nameEn: 'Returns Supplier',
      isActive: true,
    },
    create: {
      id: supplierId,
      tenantId,
      code: 'SUP-PR-001',
      nameAr: 'مورد مرتجعات',
      nameEn: 'Returns Supplier',
      isActive: true,
    },
  });

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId,
        barcode: 'PR-PROD-A',
      },
    },
    update: {
      id: productAId,
      nameAr: 'منتج مرتجعات أ',
      nameEn: 'Returns Product A',
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.LOT_EXPIRY,
    },
    create: {
      id: productAId,
      tenantId,
      nameAr: 'منتج مرتجعات أ',
      nameEn: 'Returns Product A',
      barcode: 'PR-PROD-A',
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
