import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import {
  AccountType,
  ArInvoiceStatus,
  ArReceiptMethod,
  ArReceiptStatus,
  FiscalPeriodStatus,
  NormalBalance,
  PostingRuleSetStatus,
  PrismaClient,
  SalesInvoiceStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const otherTenantId = '99999999-9999-9999-9999-999999999999';
const branchId = '22222222-2222-2222-2222-222222222222';
const customerId = '33333333-3333-3333-3333-333333333333';
const otherCustomerId = '77777777-7777-7777-7777-777777777777';
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

describe('AR Subledger (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let postedSalesInvoiceId = '';
  let otherTenantSalesInvoiceId = '';
  const uniqueRunId = fixtureRunId;

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret_value_123456';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    const fixture = await ensureFixture();
    postedSalesInvoiceId = fixture.postedSalesInvoiceId;
    otherTenantSalesInvoiceId = fixture.otherTenantSalesInvoiceId;

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

  it('creates AR invoice from posted sales invoice', async () => {
    const server = app.getHttpServer() as Server;

    const response = await request(server)
      .post(`/api/ar/invoices/from-sales/${postedSalesInvoiceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(response.status).toBe(201);
    expect(response.body.salesInvoiceId).toBe(postedSalesInvoiceId);
    expect(response.body.status).toBe(ArInvoiceStatus.OPEN);
    expect(response.body.originalAmount).toBe(115);
    expect(response.body.outstandingAmount).toBe(115);
  });

  it('creates receipt, applies allocation, and posts idempotently', async () => {
    const server = app.getHttpServer() as Server;
    const arInvoice = await prisma.arInvoice.findFirstOrThrow({
      where: {
        tenantId,
        salesInvoiceId: postedSalesInvoiceId,
      },
    });

    const createReceipt = await request(server)
      .post('/api/ar/receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        customerId,
        date: '2026-08-10T00:00:00.000Z',
        amount: 115,
        method: ArReceiptMethod.CASH,
        reference: `AR-REF-${uniqueRunId}`,
      });
    expect(createReceipt.status).toBe(201);
    expect(createReceipt.body.status).toBe(ArReceiptStatus.DRAFT);

    const apply = await request(server)
      .post(`/api/ar/receipts/${createReceipt.body.id}/apply`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        allocations: [{ invoiceId: arInvoice.id, amount: 115 }],
      });
    expect(apply.status).toBe(201);
    expect(apply.body.allocations).toHaveLength(1);

    const post1 = await request(server)
      .post(`/api/ar/receipts/${createReceipt.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(post1.status).toBe(201);
    expect(post1.body.status).toBe(ArReceiptStatus.POSTED);
    expect(post1.body.journalEntryId).toBeTruthy();

    const post2 = await request(server)
      .post(`/api/ar/receipts/${createReceipt.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(post2.status).toBe(201);
    expect(post2.body.status).toBe(ArReceiptStatus.POSTED);
    expect(post2.body.journalEntryId).toBe(post1.body.journalEntryId);

    const journals = await prisma.journalEntry.findMany({
      where: {
        tenantId,
        sourceType: 'AR_RECEIPT',
        sourceId: createReceipt.body.id as string,
      },
    });
    expect(journals).toHaveLength(1);
  });

  it('returns aging buckets', async () => {
    const agingSales1 = await prisma.salesInvoice.create({
      data: {
        tenantId,
        invoiceNo: `SI-AR-AGING-1-${uniqueRunId}`,
        status: SalesInvoiceStatus.POSTED,
        customerId,
        branchId,
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 100,
        issuedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    });
    const agingSales2 = await prisma.salesInvoice.create({
      data: {
        tenantId,
        invoiceNo: `SI-AR-AGING-2-${uniqueRunId}`,
        status: SalesInvoiceStatus.POSTED,
        customerId,
        branchId,
        subtotal: 50,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 50,
        issuedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    });

    await prisma.arInvoice.createMany({
      data: [
        {
          tenantId,
          customerId,
          salesInvoiceId: agingSales1.id,
          invoiceNo: `AR-AGING-1-${uniqueRunId}`,
          issueDate: new Date('2026-05-01T00:00:00.000Z'),
          dueDate: new Date('2026-05-31T00:00:00.000Z'),
          originalAmount: 100,
          paidAmount: 0,
          outstandingAmount: 100,
          status: ArInvoiceStatus.OPEN,
        },
        {
          tenantId,
          customerId,
          salesInvoiceId: agingSales2.id,
          invoiceNo: `AR-AGING-2-${uniqueRunId}`,
          issueDate: new Date('2026-03-01T00:00:00.000Z'),
          dueDate: new Date('2026-03-15T00:00:00.000Z'),
          originalAmount: 50,
          paidAmount: 0,
          outstandingAmount: 50,
          status: ArInvoiceStatus.OPEN,
        },
      ],
    });

    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .get('/api/ar/aging')
      .query({ asOf: '2026-07-01' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(response.status).toBe(200);
    expect(response.body.totals.totalOutstanding).toBeGreaterThan(0);
    expect(
      response.body.totals.days_31_60 + response.body.totals.days_91_plus,
    ).toBeGreaterThan(0);
  });

  it('enforces tenant isolation with cross-tenant sales invoice id', async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post(`/api/ar/invoices/from-sales/${otherTenantSalesInvoiceId}`)
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
    'accounting.read',
    'accounting.manage',
    'ar.read',
    'ar.manage',
    'sales_invoices.read',
    'sales_invoices.manage',
    'customers.read',
    'customers.manage',
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

  await prisma.customer.upsert({
    where: { id: customerId },
    update: {
      tenantId,
      name: 'AR Customer',
    },
    create: {
      id: customerId,
      tenantId,
      name: 'AR Customer',
    },
  });

  await prisma.customer.upsert({
    where: { id: otherCustomerId },
    update: {
      tenantId: otherTenantId,
      name: 'Other Tenant Customer',
    },
    create: {
      id: otherCustomerId,
      tenantId: otherTenantId,
      name: 'Other Tenant Customer',
    },
  });

  const postedSalesInvoice = await prisma.salesInvoice.create({
    data: {
      status: SalesInvoiceStatus.POSTED,
      customerId,
      branchId,
      tenantId,
      invoiceNo: `SI-AR-POSTED-${fixtureRunId}`,
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 15,
      grandTotal: 115,
      issuedAt: new Date('2026-08-05T00:00:00.000Z'),
    },
  });

  await prisma.salesInvoiceLine.deleteMany({
    where: {
      tenantId,
      invoiceId: postedSalesInvoice.id,
    },
  });
  await prisma.salesInvoiceLine.create({
    data: {
      tenantId,
      invoiceId: postedSalesInvoice.id,
      itemName: 'AR Item',
      qty: 1,
      unitPrice: 100,
      discount: 0,
      taxRate: 15,
      lineTotal: 115,
    },
  });

  const otherSalesInvoice = await prisma.salesInvoice.create({
    data: {
      status: SalesInvoiceStatus.POSTED,
      customerId: otherCustomerId,
      tenantId: otherTenantId,
      invoiceNo: `SI-AR-OTHER-${fixtureRunId}`,
      subtotal: 50,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 50,
      issuedAt: new Date('2026-08-05T00:00:00.000Z'),
    },
  });

  const requiredAccounts = [
    {
      code: '1010',
      nameAr: 'الصندوق',
      nameEn: 'Cash',
      type: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
    {
      code: '1100',
      nameAr: 'العملاء',
      nameEn: 'Accounts Receivable',
      type: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
    {
      code: '4000',
      nameAr: 'المبيعات',
      nameEn: 'Sales',
      type: AccountType.REV,
      normalBalance: NormalBalance.CREDIT,
    },
    {
      code: '2100',
      nameAr: 'ضريبة المخرجات',
      nameEn: 'Output VAT',
      type: AccountType.LIAB,
      normalBalance: NormalBalance.CREDIT,
    },
  ];

  for (const account of requiredAccounts) {
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

  await prisma.fiscalPeriod.upsert({
    where: {
      tenantId_year_month: {
        tenantId,
        year: 2026,
        month: 8,
      },
    },
    update: {
      status: FiscalPeriodStatus.OPEN,
    },
    create: {
      tenantId,
      year: 2026,
      month: 8,
      status: FiscalPeriodStatus.OPEN,
    },
  });

  await prisma.postingRuleSet.upsert({
    where: {
      tenantId_name_version: {
        tenantId,
        name: `AR_RULES_${fixtureRunId}`,
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
      name: `AR_RULES_${fixtureRunId}`,
      version: 1,
      status: PostingRuleSetStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
  });

  const activeRuleSet = await prisma.postingRuleSet.findFirstOrThrow({
    where: {
      tenantId,
      name: `AR_RULES_${fixtureRunId}`,
      version: 1,
    },
  });

  await prisma.postingRule.deleteMany({
    where: {
      tenantId,
      ruleSetId: activeRuleSet.id,
      eventType: {
        in: ['AR_INVOICE_CREATED', 'AR_RECEIPT_POSTED'],
      },
    },
  });

  await prisma.postingRule.createMany({
    data: [
      {
        tenantId,
        ruleSetId: activeRuleSet.id,
        eventType: 'AR_INVOICE_CREATED',
        priority: 100,
        debitAccountCode: '1100',
        creditAccountCode: '4000',
        amountExpr: 'outstandingAmount - taxTotal',
        isActive: true,
      },
      {
        tenantId,
        ruleSetId: activeRuleSet.id,
        eventType: 'AR_INVOICE_CREATED',
        priority: 90,
        debitAccountCode: '1100',
        creditAccountCode: '2100',
        amountExpr: 'taxTotal',
        isActive: true,
      },
      {
        tenantId,
        ruleSetId: activeRuleSet.id,
        eventType: 'AR_RECEIPT_POSTED',
        priority: 100,
        debitAccountCode: '1010',
        creditAccountCode: '1100',
        amountExpr: 'allocatedAmount',
        isActive: true,
      },
    ],
  });

  return {
    postedSalesInvoiceId: postedSalesInvoice.id,
    otherTenantSalesInvoiceId: otherSalesInvoice.id,
  };
}
