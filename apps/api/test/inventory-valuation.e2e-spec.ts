import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import {
  AccountType,
  FiscalPeriodStatus,
  NormalBalance,
  PostingRuleSetStatus,
  PrismaClient,
  PurchaseOrderStatus,
  SalesInvoiceStatus,
  TrackingMode,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '14111111-1111-1111-1111-111111111111';
const otherTenantId = '14999999-9999-9999-9999-999999999999';
const branchId = '14222222-2222-2222-2222-222222222222';
const supplierId = '14333333-3333-3333-3333-333333333333';
const customerId = '14444444-4444-4444-4444-444444444444';
const productId = '14555555-5555-5555-5555-555555555555';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const fixtureRunId = `${Date.now()}`;

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

describe('Inventory Valuation + COGS (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let purchaseOrderId = '';
  let purchaseOrderLineId = '';
  let otherTenantInvoiceId = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_inventory_valuation_e2e_secret';
    process.env.ORION_ALLOW_NEGATIVE_STOCK = 'false';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    const fixture = await ensureFixture();
    purchaseOrderId = fixture.purchaseOrderId;
    purchaseOrderLineId = fixture.purchaseOrderLineId;
    otherTenantInvoiceId = fixture.otherTenantInvoiceId;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const login = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({
        email: 'admin@orion.local',
        password: adminPassword,
        tenantId,
      })
      .set('x-tenant-id', tenantId);

    expect(login.status).toBe(201);
    accessToken = login.body.access_token as string;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('GRN IN updates valuation state, posted sale OUT updates state, and COGS posting is idempotent', async () => {
    await resetValuationStock(purchaseOrderId, purchaseOrderLineId);
    const server = app.getHttpServer() as Server;

    const createGrn = await request(server)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        purchaseOrderId,
        idempotencyKey: `grn-valuation-${fixtureRunId}`,
        lines: [
          {
            purchaseOrderLineId,
            qtyReceivedNow: 10,
          },
        ],
      });
    expect(createGrn.status).toBe(201);

    const stateAfterIn = await prisma.inventoryValuationState.findUniqueOrThrow(
      {
        where: {
          tenantId_branchId_productId: {
            tenantId,
            branchId,
            productId,
          },
        },
      },
    );
    expect(stateAfterIn.qtyOnHand).toBe(10);
    expect(stateAfterIn.avgUnitCost).toBe(4);
    expect(stateAfterIn.inventoryValue).toBe(40);

    const createDraft = await request(server)
      .post('/api/sales/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        branchId,
        customerId,
      });
    expect(createDraft.status).toBe(201);

    const invoiceId = createDraft.body.id as string;
    const addLine = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/lines`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productId,
        qty: 2,
        unitPrice: 9,
      });
    expect(addLine.status).toBe(201);

    const postInvoice = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(postInvoice.status).toBe(201);
    expect(postInvoice.body.status).toBe(SalesInvoiceStatus.POSTED);

    const stateAfterOut =
      await prisma.inventoryValuationState.findUniqueOrThrow({
        where: {
          tenantId_branchId_productId: {
            tenantId,
            branchId,
            productId,
          },
        },
      });
    expect(stateAfterOut.qtyOnHand).toBe(8);
    expect(stateAfterOut.avgUnitCost).toBe(4);
    expect(stateAfterOut.inventoryValue).toBe(32);

    const cogsJournalsAfterPost = await prisma.journalEntry.findMany({
      where: {
        tenantId,
        sourceType: 'SALES_INVOICE',
        sourceId: invoiceId,
      },
    });
    expect(cogsJournalsAfterPost).toHaveLength(1);

    const repostCogs = await request(server)
      .post(`/api/sales/invoices/${invoiceId}/post-cogs`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(repostCogs.status).toBe(201);

    const cogsJournalsAfterRepost = await prisma.journalEntry.findMany({
      where: {
        tenantId,
        sourceType: 'SALES_INVOICE',
        sourceId: invoiceId,
      },
    });
    expect(cogsJournalsAfterRepost).toHaveLength(1);
  });

  it('tenant isolation returns 404 for cross-tenant COGS posting', async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post(`/api/sales/invoices/${otherTenantInvoiceId}/post-cogs`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(response.status).toBe(404);
  });
});

async function ensureFixture() {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'ORION Inventory Valuation Tenant',
      subscriptionPlan: 'enterprise',
    },
  });

  await prisma.tenant.upsert({
    where: { id: otherTenantId },
    update: {},
    create: {
      id: otherTenantId,
      name: 'ORION Inventory Other Tenant',
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
    'sales_invoices.manage',
    'sales_invoices.read',
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
    where: { id: supplierId },
    update: {
      tenantId,
      code: `SUP-VAL-${fixtureRunId}`,
      nameAr: 'مورد التقييم',
      nameEn: 'Valuation Supplier',
    },
    create: {
      id: supplierId,
      tenantId,
      code: `SUP-VAL-${fixtureRunId}`,
      nameAr: 'مورد التقييم',
      nameEn: 'Valuation Supplier',
    },
  });

  await prisma.product.upsert({
    where: { id: productId },
    update: {
      tenantId,
      id: productId,
      nameAr: 'منتج تقييم',
      nameEn: 'Valuation Product',
      barcode: `VAL-PROD-${fixtureRunId}`,
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
    create: {
      id: productId,
      tenantId,
      nameAr: 'منتج تقييم',
      nameEn: 'Valuation Product',
      barcode: `VAL-PROD-${fixtureRunId}`,
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
  });

  await prisma.customer.upsert({
    where: { id: customerId },
    update: {
      tenantId,
      name: 'Valuation Customer',
    },
    create: {
      id: customerId,
      tenantId,
      name: 'Valuation Customer',
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

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      tenantId,
      branchId,
      supplierId,
      poNumber: `PO-VAL-${fixtureRunId}`,
      status: PurchaseOrderStatus.APPROVED,
    },
  });

  const purchaseOrderLine = await prisma.purchaseOrderLine.create({
    data: {
      tenantId,
      purchaseOrderId: purchaseOrder.id,
      productId,
      quantity: 10,
      unitPrice: 4,
      lineTotal: 40,
    },
  });

  const currentYear = new Date().getUTCFullYear();
  const currentMonth = new Date().getUTCMonth() + 1;
  await prisma.fiscalPeriod.upsert({
    where: {
      tenantId_year_month: {
        tenantId,
        year: currentYear,
        month: currentMonth,
      },
    },
    update: {
      status: FiscalPeriodStatus.OPEN,
    },
    create: {
      tenantId,
      year: currentYear,
      month: currentMonth,
      status: FiscalPeriodStatus.OPEN,
    },
  });

  const accounts = [
    {
      code: '1200',
      nameAr: 'المخزون',
      nameEn: 'Inventory',
      type: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
    {
      code: '5000',
      nameAr: 'تكلفة البضاعة المباعة',
      nameEn: 'Cost of Goods Sold',
      type: AccountType.EXP,
      normalBalance: NormalBalance.DEBIT,
    },
  ];
  for (const account of accounts) {
    await prisma.account.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: account.code,
        },
      },
      update: account,
      create: {
        tenantId,
        ...account,
      },
    });
  }

  await prisma.postingRuleSet.upsert({
    where: {
      tenantId_name_version: {
        tenantId,
        name: 'VAL_COGS_RULES',
        version: 1,
      },
    },
    update: {
      status: PostingRuleSetStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
    create: {
      tenantId,
      name: 'VAL_COGS_RULES',
      version: 1,
      status: PostingRuleSetStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
  });

  const activeRuleSet = await prisma.postingRuleSet.findFirstOrThrow({
    where: {
      tenantId,
      name: 'VAL_COGS_RULES',
      version: 1,
    },
  });

  await prisma.postingRule.deleteMany({
    where: {
      tenantId,
      ruleSetId: activeRuleSet.id,
      eventType: 'SALES_COGS_POSTED',
    },
  });

  await prisma.postingRule.create({
    data: {
      tenantId,
      ruleSetId: activeRuleSet.id,
      eventType: 'SALES_COGS_POSTED',
      priority: 100,
      debitAccountCode: '5000',
      creditAccountCode: '1200',
      amountExpr: 'totalCogs',
      isActive: true,
    },
  });

  const otherTenantInvoice = await prisma.salesInvoice.create({
    data: {
      tenantId: otherTenantId,
      invoiceNo: `SI-OTH-${fixtureRunId}`,
      status: SalesInvoiceStatus.POSTED,
      currency: 'JOD',
      branchId: null,
      createdByUserId: user.id,
    },
  });

  return {
    purchaseOrderId: purchaseOrder.id,
    purchaseOrderLineId: purchaseOrderLine.id,
    otherTenantInvoiceId: otherTenantInvoice.id,
  };
}

async function resetValuationStock(
  purchaseOrderId: string,
  purchaseOrderLineId: string,
) {
  await prisma.cogsPostingLink.deleteMany({
    where: {
      tenantId,
    },
  });

  await prisma.inventoryValuationApplied.deleteMany({
    where: {
      tenantId,
      inventoryMovement: {
        productId,
        branchId,
      },
    },
  });

  await prisma.inventoryMovement.deleteMany({
    where: {
      tenantId,
      productId,
      branchId,
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
      quantity: 0,
    },
    create: {
      tenantId,
      branchId,
      productId,
      batchNo: '',
      quantity: 0,
    },
  });

  await prisma.inventoryValuationState.upsert({
    where: {
      tenantId_branchId_productId: {
        tenantId,
        branchId,
        productId,
      },
    },
    update: {
      qtyOnHand: 0,
      avgUnitCost: 0,
      inventoryValue: 0,
    },
    create: {
      tenantId,
      branchId,
      productId,
      qtyOnHand: 0,
      avgUnitCost: 0,
      inventoryValue: 0,
    },
  });

  await prisma.goodsReceiptLine.deleteMany({
    where: {
      tenantId,
      productId,
      goodsReceipt: {
        purchaseOrderId,
      },
    },
  });

  await prisma.goodsReceipt.deleteMany({
    where: {
      tenantId,
      purchaseOrderId,
    },
  });

  await prisma.purchaseOrderLine.update({
    where: { id: purchaseOrderLineId },
    data: { receivedQuantity: 0 },
  });
}
