import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import {
  AccountType,
  FiscalPeriodStatus,
  JournalEntryStatus,
  InventoryMovementType,
  NormalBalance,
  PrismaClient,
  ReconciliationRunStatus,
  ReconciliationType,
  TrackingMode,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const branchId = randomUUID();
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const adminEmail = 'recon-admin@orion.local';

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

describe('Accounting Reconciliation (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let otherTenantRunId = '';
  let fiscalPeriodId = '';
  const runKey = `${Date.now()}`;
  const supplierBId = `sup-b-${runKey}`;

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret_value_123456';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();

    prisma = new PrismaClient();
    otherTenantRunId = await ensureFixture(runKey);
    const period = await prisma.fiscalPeriod.findUnique({
      where: {
        tenantId_year_month: {
          tenantId,
          year: 2026,
          month: 8,
        },
      },
      select: {
        id: true,
      },
    });
    fiscalPeriodId = period?.id ?? '';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const loginResponse = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
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

  it('runs reconciliation and detects match/mismatch with exception details', async () => {
    const server = app.getHttpServer() as Server;

    const response = await request(server)
      .post('/api/accounting/reconciliation/run')
      .query({ asOf: '2026-08-31' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(response.status).toBe(201);
    expect(response.body.status).toBe(ReconciliationRunStatus.COMPLETED);
    expect(Array.isArray(response.body.results)).toBe(true);
    expect(response.body.results).toHaveLength(3);

    const byType = new Map(
      (
        response.body.results as Array<{
          type: ReconciliationType;
          glBalance: number;
          subledgerBalance: number;
          delta: number;
          details: { topContributors: unknown[] };
        }>
      ).map((row) => [row.type, row]),
    );

    expect(byType.get(ReconciliationType.AR)).toMatchObject({
      glBalance: 120,
      subledgerBalance: 120,
      delta: 0,
    });
    expect(byType.get(ReconciliationType.AP)).toMatchObject({
      glBalance: 60,
      subledgerBalance: 70,
      delta: -10,
    });
    expect(byType.get(ReconciliationType.INV)).toMatchObject({
      glBalance: 450,
      subledgerBalance: 500,
      delta: -50,
    });

    expect(
      (byType.get(ReconciliationType.AR)?.details.topContributors ?? []).length,
    ).toBeGreaterThan(0);
    expect(
      (byType.get(ReconciliationType.AP)?.details.topContributors ?? []).length,
    ).toBeGreaterThan(0);
    expect(
      (byType.get(ReconciliationType.INV)?.details.topContributors ?? [])
        .length,
    ).toBeGreaterThan(0);
  });

  it('creates a new run on each execution and does not mutate previous runs', async () => {
    const server = app.getHttpServer() as Server;

    const run1 = await request(server)
      .post('/api/accounting/reconciliation/run')
      .query({ asOf: '2026-08-31' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(run1.status).toBe(201);

    await prisma.apBill.create({
      data: {
        tenantId,
        supplierId: supplierBId,
        billNo: `AP-BILL-ADD-${runKey}`,
        issueDate: new Date('2026-08-16T00:00:00.000Z'),
        originalAmount: 30,
        paidAmount: 0,
        outstandingAmount: 30,
      },
    });

    const run2 = await request(server)
      .post('/api/accounting/reconciliation/run')
      .query({ asOf: '2026-08-31' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(run2.status).toBe(201);
    expect(run2.body.id).not.toBe(run1.body.id);

    const run1Read = await request(server)
      .get(`/api/accounting/reconciliation/runs/${run1.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(run1Read.status).toBe(200);

    const run2Read = await request(server)
      .get(`/api/accounting/reconciliation/runs/${run2.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(run2Read.status).toBe(200);

    const run1Ap = (
      run1Read.body.results as Array<{
        type: ReconciliationType;
        delta: number;
      }>
    ).find((row) => row.type === ReconciliationType.AP);
    const run2Ap = (
      run2Read.body.results as Array<{
        type: ReconciliationType;
        delta: number;
      }>
    ).find((row) => row.type === ReconciliationType.AP);

    expect(run1Ap?.delta).toBe(-10);
    expect(run2Ap?.delta).toBe(-40);
  });

  it('enforces tenant isolation for reconciliation run retrieval', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/api/accounting/reconciliation/runs/${otherTenantRunId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(response.status).toBe(404);
  });

  it('rejects inconsistent periodId and asOf date', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/accounting/reconciliation/run')
      .query({ periodId: fiscalPeriodId, asOf: '2026-09-01' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(response.status).toBe(400);
  });

  it('uses inventory businessDate for as-of reconciliation instead of createdAt audit time', async () => {
    const server = app.getHttpServer() as Server;
    const productId = `prod-c-${runKey}`;
    const inventoryAccount = await prisma.account.findFirstOrThrow({
      where: {
        tenantId,
        code: '1200',
      },
      select: {
        id: true,
      },
    });
    const offsetAccount = await prisma.account.findFirstOrThrow({
      where: {
        tenantId,
        code: '5000',
      },
      select: {
        id: true,
      },
    });

    await prisma.product.create({
      data: {
        id: productId,
        tenantId,
        nameEn: 'Inventory Timing Product',
        nameAr: 'منتج توقيت المخزون',
        barcode: `BC-C-${runKey}`,
        strength: '1',
        packSize: '1',
        trackingMode: TrackingMode.NONE,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        tenantId,
        branchId,
        productId,
        businessDate: new Date('2026-08-20T00:00:00.000Z'),
        movementType: InventoryMovementType.IN,
        quantity: 3,
        unitCost: 25,
        costTotal: 75,
        reason: 'business-date fixture',
        createdAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    await prisma.journalEntry.create({
      data: {
        tenantId,
        entryNo: `JE-BDATE-${runKey}`,
        date: new Date('2026-08-20T00:00:00.000Z'),
        description: 'Inventory business date fixture',
        status: JournalEntryStatus.POSTED,
        sourceType: 'INV_BUSINESS_DATE_FIXTURE',
        sourceId: productId,
        branchId,
        fiscalPeriodId,
        lines: {
          create: [
            {
              tenantId,
              accountId: inventoryAccount.id,
              debit: 75,
              credit: 0,
              branchId,
            },
            {
              tenantId,
              accountId: offsetAccount.id,
              debit: 0,
              credit: 75,
              branchId,
            },
          ],
        },
      },
    });

    const response = await request(server)
      .post('/api/accounting/reconciliation/run')
      .query({ as_of_date: '2026-08-31' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(response.status).toBe(201);
    const inventoryRow = (
      response.body.results as Array<{
        type: ReconciliationType;
        glBalance: number;
        subledgerBalance: number;
        delta: number;
      }>
    ).find((row) => row.type === ReconciliationType.INV);

    expect(inventoryRow).toMatchObject({
      glBalance: 525,
      subledgerBalance: 575,
      delta: -50,
    });
  });
});

async function ensureFixture(unique: string) {
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

  for (const key of ['accounting.read', 'accounting.manage']) {
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
    where: { email: adminEmail },
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
      email: adminEmail,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.accountingSetting.upsert({
    where: { tenantId },
    update: {
      arControlAccountCode: '1100',
      apControlAccountCode: '2000',
      inventoryControlAccountCode: '1200',
    },
    create: {
      tenantId,
      arControlAccountCode: '1100',
      apControlAccountCode: '2000',
      inventoryControlAccountCode: '1200',
    },
  });

  await prisma.accountingSetting.upsert({
    where: { tenantId: otherTenantId },
    update: {
      arControlAccountCode: '1100',
      apControlAccountCode: '2000',
      inventoryControlAccountCode: '1200',
    },
    create: {
      tenantId: otherTenantId,
      arControlAccountCode: '1100',
      apControlAccountCode: '2000',
      inventoryControlAccountCode: '1200',
    },
  });

  await upsertAccount('1010', 'Cash', AccountType.ASSET, NormalBalance.DEBIT);
  await upsertAccount(
    '1100',
    'AR Control',
    AccountType.ASSET,
    NormalBalance.DEBIT,
  );
  await upsertAccount(
    '1200',
    'Inventory Control',
    AccountType.ASSET,
    NormalBalance.DEBIT,
  );
  await upsertAccount(
    '2000',
    'AP Control',
    AccountType.LIAB,
    NormalBalance.CREDIT,
  );
  await upsertAccount('4000', 'Revenue', AccountType.REV, NormalBalance.CREDIT);
  await upsertAccount('5000', 'Expense', AccountType.EXP, NormalBalance.DEBIT);

  await prisma.customer.upsert({
    where: { id: `cust-a-${unique}` },
    update: {
      tenantId,
      name: 'Customer A',
    },
    create: {
      id: `cust-a-${unique}`,
      tenantId,
      name: 'Customer A',
    },
  });
  await prisma.customer.upsert({
    where: { id: `cust-b-${unique}` },
    update: {
      tenantId,
      name: 'Customer B',
    },
    create: {
      id: `cust-b-${unique}`,
      tenantId,
      name: 'Customer B',
    },
  });

  await prisma.supplier.upsert({
    where: { id: `sup-a-${unique}` },
    update: {
      tenantId,
      code: `SUP-A-${unique}`,
      nameAr: 'مورد أ',
      nameEn: 'Supplier A',
      isActive: true,
    },
    create: {
      id: `sup-a-${unique}`,
      tenantId,
      code: `SUP-A-${unique}`,
      nameAr: 'مورد أ',
      nameEn: 'Supplier A',
      isActive: true,
    },
  });
  await prisma.supplier.upsert({
    where: { id: `sup-b-${unique}` },
    update: {
      tenantId,
      code: `SUP-B-${unique}`,
      nameAr: 'مورد ب',
      nameEn: 'Supplier B',
      isActive: true,
    },
    create: {
      id: `sup-b-${unique}`,
      tenantId,
      code: `SUP-B-${unique}`,
      nameAr: 'مورد ب',
      nameEn: 'Supplier B',
      isActive: true,
    },
  });

  await prisma.salesInvoice.upsert({
    where: { id: `si-a-${unique}` },
    update: {
      tenantId,
      invoiceNo: `SI-A-${unique}`,
      branchId,
      customerId: `cust-a-${unique}`,
      status: 'POSTED',
      grandTotal: 70,
      subtotal: 70,
    },
    create: {
      id: `si-a-${unique}`,
      tenantId,
      invoiceNo: `SI-A-${unique}`,
      branchId,
      customerId: `cust-a-${unique}`,
      status: 'POSTED',
      grandTotal: 70,
      subtotal: 70,
    },
  });

  await prisma.salesInvoice.upsert({
    where: { id: `si-b-${unique}` },
    update: {
      tenantId,
      invoiceNo: `SI-B-${unique}`,
      branchId,
      customerId: `cust-b-${unique}`,
      status: 'POSTED',
      grandTotal: 50,
      subtotal: 50,
    },
    create: {
      id: `si-b-${unique}`,
      tenantId,
      invoiceNo: `SI-B-${unique}`,
      branchId,
      customerId: `cust-b-${unique}`,
      status: 'POSTED',
      grandTotal: 50,
      subtotal: 50,
    },
  });

  await prisma.product.upsert({
    where: { id: `prod-a-${unique}` },
    update: {
      tenantId,
      nameAr: 'منتج أ',
      nameEn: 'Product A',
      barcode: `PROD-A-${unique}`,
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
    create: {
      id: `prod-a-${unique}`,
      tenantId,
      nameAr: 'منتج أ',
      nameEn: 'Product A',
      barcode: `PROD-A-${unique}`,
      strength: '10mg',
      packSize: '10',
      trackingMode: TrackingMode.NONE,
    },
  });
  await prisma.product.upsert({
    where: { id: `prod-b-${unique}` },
    update: {
      tenantId,
      nameAr: 'منتج ب',
      nameEn: 'Product B',
      barcode: `PROD-B-${unique}`,
      strength: '20mg',
      packSize: '20',
      trackingMode: TrackingMode.NONE,
    },
    create: {
      id: `prod-b-${unique}`,
      tenantId,
      nameAr: 'منتج ب',
      nameEn: 'Product B',
      barcode: `PROD-B-${unique}`,
      strength: '20mg',
      packSize: '20',
      trackingMode: TrackingMode.NONE,
    },
  });

  await prisma.arInvoice.upsert({
    where: { id: `ar-a-${unique}` },
    update: {
      tenantId,
      customerId: `cust-a-${unique}`,
      salesInvoiceId: `si-a-${unique}`,
      invoiceNo: `AR-INV-A-${unique}`,
      issueDate: new Date('2026-08-05T00:00:00.000Z'),
      originalAmount: 70,
      paidAmount: 0,
      outstandingAmount: 70,
    },
    create: {
      id: `ar-a-${unique}`,
      tenantId,
      customerId: `cust-a-${unique}`,
      salesInvoiceId: `si-a-${unique}`,
      invoiceNo: `AR-INV-A-${unique}`,
      issueDate: new Date('2026-08-05T00:00:00.000Z'),
      originalAmount: 70,
      paidAmount: 0,
      outstandingAmount: 70,
    },
  });

  await prisma.arInvoice.upsert({
    where: { id: `ar-b-${unique}` },
    update: {
      tenantId,
      customerId: `cust-b-${unique}`,
      salesInvoiceId: `si-b-${unique}`,
      invoiceNo: `AR-INV-B-${unique}`,
      issueDate: new Date('2026-08-12T00:00:00.000Z'),
      originalAmount: 50,
      paidAmount: 0,
      outstandingAmount: 50,
    },
    create: {
      id: `ar-b-${unique}`,
      tenantId,
      customerId: `cust-b-${unique}`,
      salesInvoiceId: `si-b-${unique}`,
      invoiceNo: `AR-INV-B-${unique}`,
      issueDate: new Date('2026-08-12T00:00:00.000Z'),
      originalAmount: 50,
      paidAmount: 0,
      outstandingAmount: 50,
    },
  });

  await prisma.apBill.upsert({
    where: { id: `ap-a-${unique}` },
    update: {
      tenantId,
      supplierId: `sup-a-${unique}`,
      billNo: `AP-BILL-A-${unique}`,
      issueDate: new Date('2026-08-10T00:00:00.000Z'),
      originalAmount: 30,
      paidAmount: 0,
      outstandingAmount: 30,
    },
    create: {
      id: `ap-a-${unique}`,
      tenantId,
      supplierId: `sup-a-${unique}`,
      billNo: `AP-BILL-A-${unique}`,
      issueDate: new Date('2026-08-10T00:00:00.000Z'),
      originalAmount: 30,
      paidAmount: 0,
      outstandingAmount: 30,
    },
  });

  await prisma.apBill.upsert({
    where: { id: `ap-b-${unique}` },
    update: {
      tenantId,
      supplierId: `sup-b-${unique}`,
      billNo: `AP-BILL-B-${unique}`,
      issueDate: new Date('2026-08-15T00:00:00.000Z'),
      originalAmount: 40,
      paidAmount: 0,
      outstandingAmount: 40,
    },
    create: {
      id: `ap-b-${unique}`,
      tenantId,
      supplierId: `sup-b-${unique}`,
      billNo: `AP-BILL-B-${unique}`,
      issueDate: new Date('2026-08-15T00:00:00.000Z'),
      originalAmount: 40,
      paidAmount: 0,
      outstandingAmount: 40,
    },
  });

  await prisma.inventoryValuationState.upsert({
    where: {
      tenantId_branchId_productId: {
        tenantId,
        branchId,
        productId: `prod-a-${unique}`,
      },
    },
    update: {
      qtyOnHand: 10,
      avgUnitCost: 30,
      inventoryValue: 300,
    },
    create: {
      tenantId,
      branchId,
      productId: `prod-a-${unique}`,
      qtyOnHand: 10,
      avgUnitCost: 30,
      inventoryValue: 300,
    },
  });

  await prisma.inventoryMovement.upsert({
    where: { id: `mov-a-${unique}` },
    update: {
      tenantId,
      branchId,
      productId: `prod-a-${unique}`,
      movementType: InventoryMovementType.IN,
      quantity: 10,
      businessDate: new Date('2026-08-18T00:00:00.000Z'),
      unitCost: 30,
      costTotal: 300,
      reason: 'reconciliation fixture',
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    },
    create: {
      id: `mov-a-${unique}`,
      tenantId,
      branchId,
      productId: `prod-a-${unique}`,
      movementType: InventoryMovementType.IN,
      quantity: 10,
      businessDate: new Date('2026-08-18T00:00:00.000Z'),
      unitCost: 30,
      costTotal: 300,
      reason: 'reconciliation fixture',
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    },
  });

  await prisma.inventoryMovement.upsert({
    where: { id: `mov-b-${unique}` },
    update: {
      tenantId,
      branchId,
      productId: `prod-b-${unique}`,
      movementType: InventoryMovementType.IN,
      quantity: 10,
      businessDate: new Date('2026-08-18T00:00:00.000Z'),
      unitCost: 20,
      costTotal: 200,
      reason: 'reconciliation fixture',
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    },
    create: {
      id: `mov-b-${unique}`,
      tenantId,
      branchId,
      productId: `prod-b-${unique}`,
      movementType: InventoryMovementType.IN,
      quantity: 10,
      businessDate: new Date('2026-08-18T00:00:00.000Z'),
      unitCost: 20,
      costTotal: 200,
      reason: 'reconciliation fixture',
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    },
  });

  await prisma.inventoryValuationState.upsert({
    where: {
      tenantId_branchId_productId: {
        tenantId,
        branchId,
        productId: `prod-b-${unique}`,
      },
    },
    update: {
      qtyOnHand: 10,
      avgUnitCost: 20,
      inventoryValue: 200,
    },
    create: {
      tenantId,
      branchId,
      productId: `prod-b-${unique}`,
      qtyOnHand: 10,
      avgUnitCost: 20,
      inventoryValue: 200,
    },
  });

  await ensurePostedJournal(unique, 'AR', [
    { accountCode: '1100', debit: 120, credit: 0 },
    { accountCode: '4000', debit: 0, credit: 120 },
  ]);
  await ensurePostedJournal(unique, 'AP', [
    { accountCode: '5000', debit: 60, credit: 0 },
    { accountCode: '2000', debit: 0, credit: 60 },
  ]);
  await ensurePostedJournal(unique, 'INV', [
    { accountCode: '1200', debit: 450, credit: 0 },
    { accountCode: '4000', debit: 0, credit: 450 },
  ]);

  const otherRun = await prisma.reconciliationRun.create({
    data: {
      tenantId: otherTenantId,
      asOfDate: new Date('2026-08-31T23:59:59.999Z'),
      status: ReconciliationRunStatus.COMPLETED,
      results: {
        create: {
          tenantId: otherTenantId,
          type: ReconciliationType.AR,
          controlAccountCode: '1100',
          glBalance: 1,
          subledgerBalance: 1,
          delta: 0,
          details: {
            asOfDate: '2026-08-31T23:59:59.999Z',
            topContributors: [],
          },
        },
      },
    },
  });

  return otherRun.id;
}

async function upsertAccount(
  code: string,
  nameEn: string,
  type: AccountType,
  normalBalance: NormalBalance,
) {
  await prisma.account.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code,
      },
    },
    update: {
      nameAr: nameEn,
      nameEn,
      type,
      normalBalance,
      isControl: ['1100', '1200', '2000'].includes(code),
      isActive: true,
    },
    create: {
      tenantId,
      code,
      nameAr: nameEn,
      nameEn,
      type,
      normalBalance,
      isControl: ['1100', '1200', '2000'].includes(code),
      isActive: true,
    },
  });
}

async function ensurePostedJournal(
  unique: string,
  tag: string,
  lines: Array<{ accountCode: string; debit: number; credit: number }>,
) {
  const lineRows = await prisma.account.findMany({
    where: {
      tenantId,
      code: {
        in: lines.map((line) => line.accountCode),
      },
    },
    select: {
      id: true,
      code: true,
    },
  });
  const map = new Map(lineRows.map((row) => [row.code, row.id]));

  const period = await prisma.fiscalPeriod.upsert({
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

  await prisma.journalEntry.upsert({
    where: {
      tenantId_entryNo: {
        tenantId,
        entryNo: `JE-REC-${tag}-${unique}`,
      },
    },
    update: {
      status: JournalEntryStatus.POSTED,
      date: new Date('2026-08-20T00:00:00.000Z'),
      fiscalPeriodId: period.id,
      lines: {
        deleteMany: {},
        create: lines.map((line) => ({
          tenantId,
          accountId: map.get(line.accountCode) as string,
          debit: line.debit,
          credit: line.credit,
          branchId,
        })),
      },
    },
    create: {
      tenantId,
      entryNo: `JE-REC-${tag}-${unique}`,
      date: new Date('2026-08-20T00:00:00.000Z'),
      description: `Reconciliation seed ${tag}`,
      status: JournalEntryStatus.POSTED,
      branchId,
      fiscalPeriodId: period.id,
      lines: {
        create: lines.map((line) => ({
          tenantId,
          accountId: map.get(line.accountCode) as string,
          debit: line.debit,
          credit: line.credit,
          branchId,
        })),
      },
    },
  });
}
