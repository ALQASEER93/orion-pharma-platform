import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaClient, SalesInvoiceStatus, TrackingMode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const otherTenantId = '99999999-9999-9999-9999-999999999999';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const branchId = '22222222-2222-2222-2222-222222222222';
const productId = 'a6666666-6666-6666-6666-666666666666';
const customerId = 'a7777777-7777-7777-7777-777777777777';
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

describe('Sales Invoices + POS (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let otherTenantInvoiceId = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret';
    process.env.ORION_ALLOW_NEGATIVE_STOCK = 'false';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    otherTenantInvoiceId = await ensureFixture();

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

  it('create invoice -> post creates OUT movements + snapshots, second post is idempotent', async () => {
    await resetStock(12);

    const server = app.getHttpServer() as Server;

    const createDraft = await request(server)
      .post('/api/sales/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        customerId,
        currency: 'JOD',
        branchId,
      });
    expect(createDraft.status).toBe(201);
    expect(createDraft.body.status).toBe(SalesInvoiceStatus.DRAFT);
    const invoiceId = (createDraft.body as { id: string }).id;

    const addLine = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/lines`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productId,
        qty: 3,
        unitPrice: 10,
        discount: 1,
        taxRate: 10,
      });
    expect(addLine.status).toBe(201);
    expect(addLine.body.lines).toHaveLength(1);

    const postInvoice = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(postInvoice.status).toBe(201);
    expect(postInvoice.body.status).toBe(SalesInvoiceStatus.POSTED);

    const invoiceLines = await prisma.salesInvoiceLine.findMany({
      where: {
        invoiceId,
        tenantId,
      },
    });

    expect(invoiceLines).toHaveLength(1);
    expect(invoiceLines[0].unitCostSnapshot).not.toBeNull();
    expect(invoiceLines[0].costMethodSnapshot).toBe('MOVING_AVG');

    const movementCountAfterFirstPost = await prisma.inventoryMovement.count({
      where: {
        tenantId,
        salesInvoiceLineId: invoiceLines[0].id,
        movementType: 'OUT',
      },
    });
    expect(movementCountAfterFirstPost).toBe(1);

    const repost = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(repost.status).toBe(201);
    expect(repost.body.status).toBe(SalesInvoiceStatus.POSTED);

    const movementCountAfterRepost = await prisma.inventoryMovement.count({
      where: {
        tenantId,
        salesInvoiceLineId: invoiceLines[0].id,
        movementType: 'OUT',
      },
    });
    expect(movementCountAfterRepost).toBe(1);
  });

  it('insufficient stock blocks posting with stable code', async () => {
    await resetStock(1);

    const server = app.getHttpServer() as Server;

    const createDraft = await request(server)
      .post('/api/sales/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        customerId,
        currency: 'JOD',
        branchId,
      });
    expect(createDraft.status).toBe(201);

    const invoiceId = (createDraft.body as { id: string }).id;

    const addLine = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/lines`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productId,
        qty: 5,
        unitPrice: 10,
      });
    expect(addLine.status).toBe(201);

    const postInvoice = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(postInvoice.status).toBe(409);
    expect(postInvoice.body.code).toBe('STOCK_INSUFFICIENT');
    expect(Array.isArray(postInvoice.body.details)).toBe(true);
  });

  it('returns 404 for cross-tenant invoice id', async () => {
    const server = app.getHttpServer() as Server;

    const crossDetail = await request(server)
      .get(`/api/sales/invoices/${otherTenantInvoiceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(crossDetail.status).toBe(404);

    const crossPatch = await request(server)
      .patch(`/api/sales/invoices/${otherTenantInvoiceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ currency: 'USD' });
    expect(crossPatch.status).toBe(404);
  });

  it('checkout via /pos/checkout creates posted invoice + payment + OUT movement', async () => {
    await resetStock(4);

    const server = app.getHttpServer() as Server;

    const checkout = await request(server)
      .post('/api/pos/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        customerId,
        lines: [{ productId, qty: 2, unitPrice: 15 }],
        payment: { method: 'CASH', amount: 30 },
      });

    expect(checkout.status).toBe(201);
    expect(checkout.body.status).toBe(SalesInvoiceStatus.POSTED);
    expect(
      (checkout.body.payments as Array<{ amount: number }>)[0].amount,
    ).toBe(30);

    const lineId = (checkout.body.lines as Array<{ id: string }>)[0].id;
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        salesInvoiceLineId: lineId,
      },
    });

    expect(movements).toHaveLength(1);
    expect(movements[0].movementType).toBe('OUT');
    expect(movements[0].quantity).toBe(-2);
  });

  it('checkout is blocked when stock is insufficient', async () => {
    await resetStock(1);

    const server = app.getHttpServer() as Server;

    const checkout = await request(server)
      .post('/api/pos/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        customerId,
        lines: [{ productId, qty: 3, unitPrice: 15 }],
        payment: { method: 'CASH', amount: 45 },
      });

    expect(checkout.status).toBe(409);
    expect(checkout.body.code).toBe('STOCK_INSUFFICIENT');
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
      name: 'ORION Secondary Tenant',
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
    'sales_invoices.read',
    'sales_invoices.manage',
    'pos.checkout',
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

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId,
        barcode: 'SALE-PROD-001',
      },
    },
    update: {
      id: productId,
      nameAr: 'منتج مبيعات',
      nameEn: 'Sales Product',
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
    create: {
      id: productId,
      tenantId,
      nameAr: 'منتج مبيعات',
      nameEn: 'Sales Product',
      barcode: 'SALE-PROD-001',
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
  });

  await prisma.customer.upsert({
    where: { id: customerId },
    update: {
      tenantId,
      name: 'Customer Alpha',
      phone: '+966500000123',
    },
    create: {
      id: customerId,
      tenantId,
      name: 'Customer Alpha',
      phone: '+966500000123',
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const user = await prisma.user.upsert({
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

  await resetStock(12);

  const otherInvoice = await prisma.salesInvoice.upsert({
    where: {
      tenantId_invoiceNo: {
        tenantId: otherTenantId,
        invoiceNo: 'SI-2026-999999',
      },
    },
    update: {
      tenantId: otherTenantId,
      invoiceNo: 'SI-2026-999999',
      status: SalesInvoiceStatus.DRAFT,
      currency: 'JOD',
      branchId: null,
      createdByUserId: user.id,
    },
    create: {
      tenantId: otherTenantId,
      invoiceNo: 'SI-2026-999999',
      status: SalesInvoiceStatus.DRAFT,
      currency: 'JOD',
      branchId: null,
      createdByUserId: user.id,
    },
  });

  return otherInvoice.id;
}

async function resetStock(quantity: number) {
  await prisma.inventoryMovement.deleteMany({
    where: {
      tenantId,
      branchId,
      productId,
      reason: 'sales e2e stock reset',
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      tenantId_branchId_productId_batchNo: {
        tenantId,
        branchId,
        productId,
        batchNo: '',
      },
    },
    update: {
      quantity,
    },
    create: {
      tenantId,
      branchId,
      productId,
      batchNo: '',
      quantity,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      tenantId,
      branchId,
      productId,
      movementType: 'IN',
      quantity,
      reason: 'sales e2e stock reset',
    },
  });
}
