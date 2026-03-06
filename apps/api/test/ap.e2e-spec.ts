import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import {
  AccountType,
  ApBillStatus,
  ApPaymentMethod,
  ApPaymentStatus,
  FiscalPeriodStatus,
  NormalBalance,
  PostingRuleSetStatus,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '12111111-1111-1111-1111-111111111111';
const otherTenantId = '12999999-9999-9999-9999-999999999999';
const branchId = '12222222-2222-2222-2222-222222222222';
const supplierId = '12333333-3333-3333-3333-333333333333';
const otherSupplierId = '12777777-7777-7777-7777-777777777777';
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

describe('AP Subledger (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let otherTenantBillId = '';
  const uniqueRunId = fixtureRunId;

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_ap_e2e_test_secret_value_123456';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    const fixture = await ensureFixture();
    otherTenantBillId = fixture.otherTenantBillId;

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

  it('create bill -> create payment -> apply -> post and idempotency guard', async () => {
    const server = app.getHttpServer() as Server;

    const createBill = await request(server)
      .post('/api/ap/bills')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        supplierId,
        issueDate: '2026-08-10T00:00:00.000Z',
        dueDate: '2026-08-25T00:00:00.000Z',
        originalAmount: 150,
        sourceType: 'MANUAL',
        sourceId: `MANUAL-${uniqueRunId}`,
      });
    expect(createBill.status).toBe(201);
    expect(createBill.body.status).toBe(ApBillStatus.OPEN);
    expect(createBill.body.outstandingAmount).toBe(150);
    expect(createBill.body.journalEntryId).toBeTruthy();

    const createPayment = await request(server)
      .post('/api/ap/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        supplierId,
        date: '2026-08-20T00:00:00.000Z',
        amount: 150,
        method: ApPaymentMethod.BANK,
        reference: `AP-REF-${uniqueRunId}`,
      });
    expect(createPayment.status).toBe(201);
    expect(createPayment.body.status).toBe(ApPaymentStatus.DRAFT);

    const apply = await request(server)
      .post(`/api/ap/payments/${createPayment.body.id}/apply`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        allocations: [{ billId: createBill.body.id, amount: 150 }],
      });
    expect(apply.status).toBe(201);
    expect(apply.body.allocations).toHaveLength(1);
    expect(apply.body.allocations[0].amount).toBe(150);

    const post1 = await request(server)
      .post(`/api/ap/payments/${createPayment.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(post1.status).toBe(201);
    expect(post1.body.status).toBe(ApPaymentStatus.POSTED);
    expect(post1.body.journalEntryId).toBeTruthy();

    const post2 = await request(server)
      .post(`/api/ap/payments/${createPayment.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(post2.status).toBe(409);

    const journals = await prisma.journalEntry.findMany({
      where: {
        tenantId,
        sourceType: 'AP_PAYMENT',
        sourceId: createPayment.body.id as string,
      },
    });
    expect(journals).toHaveLength(1);
  });

  it('returns AP aging buckets', async () => {
    const oldBill = await prisma.apBill.create({
      data: {
        tenantId,
        supplierId,
        billNo: `AP-AGING-OLD-${uniqueRunId}`,
        issueDate: new Date('2026-03-01T00:00:00.000Z'),
        dueDate: new Date('2026-03-15T00:00:00.000Z'),
        status: ApBillStatus.OPEN,
        originalAmount: 120,
        paidAmount: 0,
        outstandingAmount: 120,
      },
    });
    const recentBill = await prisma.apBill.create({
      data: {
        tenantId,
        supplierId,
        billNo: `AP-AGING-RECENT-${uniqueRunId}`,
        issueDate: new Date('2026-06-15T00:00:00.000Z'),
        dueDate: new Date('2026-07-10T00:00:00.000Z'),
        status: ApBillStatus.OPEN,
        originalAmount: 80,
        paidAmount: 0,
        outstandingAmount: 80,
      },
    });
    expect(oldBill.id).toBeTruthy();
    expect(recentBill.id).toBeTruthy();

    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .get('/api/ap/aging')
      .query({ asOf: '2026-07-31' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(response.status).toBe(200);
    expect(response.body.totals.totalOutstanding).toBeGreaterThan(0);
    expect(
      response.body.totals.days_31_60 + response.body.totals.days_91_plus,
    ).toBeGreaterThan(0);
  });

  it('keeps AP exposure before void, excludes it after void, and posts reversal journal', async () => {
    const server = app.getHttpServer() as Server;
    const baselineBefore = await request(server)
      .get('/api/ap/aging')
      .query({ as_of_date: '2026-08-19' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    const baselineAfter = await request(server)
      .get('/api/ap/aging')
      .query({ as_of_date: '2026-08-21' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(baselineBefore.status).toBe(200);
    expect(baselineAfter.status).toBe(200);

    const createBill = await request(server)
      .post('/api/ap/bills')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        supplierId,
        issueDate: '2026-08-10T00:00:00.000Z',
        dueDate: '2026-08-25T00:00:00.000Z',
        originalAmount: 90,
        sourceType: 'MANUAL',
        sourceId: `VOID-MANUAL-${uniqueRunId}`,
      });
    expect(createBill.status).toBe(201);

    const voidResponse = await request(server)
      .post(`/api/ap/bills/${createBill.body.id}/void`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(voidResponse.status).toBe(201);
    expect(voidResponse.body.status).toBe(ApBillStatus.VOID);
    expect(voidResponse.body.voidedAt).toBeTruthy();

    const fixedVoidDate = new Date('2026-08-20T00:00:00.000Z');
    const reversalJournal = await prisma.journalEntry.findFirstOrThrow({
      where: {
        tenantId,
        sourceType: 'AP_BILL_VOID',
        sourceId: createBill.body.id as string,
      },
    });

    await prisma.$transaction([
      prisma.apBill.update({
        where: {
          id: createBill.body.id as string,
        },
        data: {
          voidedAt: fixedVoidDate,
        },
      }),
      prisma.journalEntry.update({
        where: {
          id: reversalJournal.id,
        },
        data: {
          date: fixedVoidDate,
        },
      }),
    ]);

    const beforeVoid = await request(server)
      .get('/api/ap/aging')
      .query({ as_of_date: '2026-08-19' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(beforeVoid.status).toBe(200);
    expect(
      (beforeVoid.body.bills as Array<{ billId: string }>).some(
        (bill) => bill.billId === createBill.body.id,
      ),
    ).toBe(true);

    const afterVoid = await request(server)
      .get('/api/ap/aging')
      .query({ as_of_date: '2026-08-21' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(afterVoid.status).toBe(200);
    expect(
      (afterVoid.body.bills as Array<{ billId: string }>).some(
        (bill) => bill.billId === createBill.body.id,
      ),
    ).toBe(false);
    expect(
      beforeVoid.body.totals.totalOutstanding -
        baselineBefore.body.totals.totalOutstanding,
    ).toBe(90);
    expect(
      afterVoid.body.totals.totalOutstanding -
        baselineAfter.body.totals.totalOutstanding,
    ).toBe(0);
  });

  it('enforces tenant isolation with cross-tenant bill id', async () => {
    const server = app.getHttpServer() as Server;
    const createPayment = await request(server)
      .post('/api/ap/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        supplierId,
        date: '2026-08-22T00:00:00.000Z',
        amount: 1,
        method: ApPaymentMethod.CASH,
      });
    expect(createPayment.status).toBe(201);

    const response = await request(server)
      .post(`/api/ap/payments/${createPayment.body.id}/apply`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        allocations: [{ billId: otherTenantBillId, amount: 1 }],
      });

    expect(response.status).toBe(404);
  });
});

async function ensureFixture() {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'ORION AP Demo Tenant',
      subscriptionPlan: 'enterprise',
    },
  });

  await prisma.tenant.upsert({
    where: { id: otherTenantId },
    update: {},
    create: {
      id: otherTenantId,
      name: 'ORION AP Other Tenant',
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

  const permissionKeys = ['ap.read', 'ap.manage'];
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

  await prisma.supplier.upsert({
    where: { id: supplierId },
    update: {
      tenantId,
      code: `SUP-AP-${fixtureRunId}`,
      nameAr: 'مورد اختبارات AP',
      nameEn: `AP Supplier ${fixtureRunId}`,
    },
    create: {
      id: supplierId,
      tenantId,
      code: `SUP-AP-${fixtureRunId}`,
      nameAr: 'مورد اختبارات AP',
      nameEn: `AP Supplier ${fixtureRunId}`,
    },
  });

  await prisma.supplier.upsert({
    where: { id: otherSupplierId },
    update: {
      tenantId: otherTenantId,
      code: `SUP-OTH-${fixtureRunId}`,
      nameAr: 'مورد آخر',
      nameEn: `Other Supplier ${fixtureRunId}`,
    },
    create: {
      id: otherSupplierId,
      tenantId: otherTenantId,
      code: `SUP-OTH-${fixtureRunId}`,
      nameAr: 'مورد آخر',
      nameEn: `Other Supplier ${fixtureRunId}`,
    },
  });

  const otherTenantBill = await prisma.apBill.create({
    data: {
      tenantId: otherTenantId,
      supplierId: otherSupplierId,
      billNo: `AP-OTH-${fixtureRunId}`,
      issueDate: new Date('2026-08-01T00:00:00.000Z'),
      dueDate: new Date('2026-08-30T00:00:00.000Z'),
      status: ApBillStatus.OPEN,
      originalAmount: 10,
      paidAmount: 0,
      outstandingAmount: 10,
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
      code: '1200',
      nameAr: 'المخزون',
      nameEn: 'Inventory',
      type: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
    {
      code: '2000',
      nameAr: 'الموردون',
      nameEn: 'Accounts Payable',
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

  const now = new Date();
  await prisma.fiscalPeriod.upsert({
    where: {
      tenantId_year_month: {
        tenantId,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
      },
    },
    update: {
      status: FiscalPeriodStatus.OPEN,
    },
    create: {
      tenantId,
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      status: FiscalPeriodStatus.OPEN,
    },
  });

  await prisma.postingRuleSet.upsert({
    where: {
      tenantId_name_version: {
        tenantId,
        name: `AP_RULES_${fixtureRunId}`,
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
      name: `AP_RULES_${fixtureRunId}`,
      version: 1,
      status: PostingRuleSetStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
  });

  const activeRuleSet = await prisma.postingRuleSet.findFirstOrThrow({
    where: {
      tenantId,
      name: `AP_RULES_${fixtureRunId}`,
      version: 1,
    },
  });

  await prisma.postingRule.deleteMany({
    where: {
      tenantId,
      ruleSetId: activeRuleSet.id,
      eventType: {
        in: ['AP_BILL_CREATED', 'AP_PAYMENT_POSTED'],
      },
    },
  });

  await prisma.postingRule.createMany({
    data: [
      {
        tenantId,
        ruleSetId: activeRuleSet.id,
        eventType: 'AP_BILL_CREATED',
        priority: 100,
        debitAccountCode: '1200',
        creditAccountCode: '2000',
        amountExpr: 'outstandingAmount',
        isActive: true,
      },
      {
        tenantId,
        ruleSetId: activeRuleSet.id,
        eventType: 'AP_PAYMENT_POSTED',
        priority: 100,
        debitAccountCode: '2000',
        creditAccountCode: '1010',
        amountExpr: 'allocatedAmount',
        isActive: true,
      },
    ],
  });

  return {
    otherTenantBillId: otherTenantBill.id,
  };
}
