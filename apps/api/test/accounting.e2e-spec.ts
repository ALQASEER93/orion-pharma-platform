import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import {
  AccountType,
  FiscalPeriodStatus,
  JournalEntryStatus,
  NormalBalance,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const otherTenantId = '99999999-9999-9999-9999-999999999999';
const branchId = '22222222-2222-2222-2222-222222222222';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';

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

describe('Accounting Foundation (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let otherTenantJournalId = '';
  const uniqueRunId = `${Date.now()}`;

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    otherTenantJournalId = await ensureFixture();

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

  it('seeds default COA', async () => {
    const server = app.getHttpServer() as Server;

    const seed = await request(server)
      .post('/api/accounting/coa/seed-default')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({});

    expect(seed.status).toBe(201);
    expect(seed.body.seededCount).toBeGreaterThan(0);

    const list = await request(server)
      .get('/api/accounting/coa')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect((list.body as Array<{ code: string }>).length).toBeGreaterThan(0);
  });

  it('creates draft journal then posts balanced entry', async () => {
    const server = app.getHttpServer() as Server;
    const [cash, sales] = await requiredAccounts(['1010', '4000']);

    await prisma.fiscalPeriod.upsert({
      where: {
        tenantId_year_month: {
          tenantId,
          year: 2026,
          month: 2,
        },
      },
      update: {
        status: FiscalPeriodStatus.OPEN,
      },
      create: {
        tenantId,
        year: 2026,
        month: 2,
        status: FiscalPeriodStatus.OPEN,
      },
    });

    const create = await request(server)
      .post('/api/accounting/journals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        date: '2026-02-15T00:00:00.000Z',
        description: 'Balanced test entry',
        sourceType: 'TEST',
        sourceId: `BALANCED-${uniqueRunId}`,
        branchId,
        lines: [
          { accountId: cash.id, debit: 100, credit: 0, branchId },
          { accountId: sales.id, debit: 0, credit: 100, branchId },
        ],
      });

    expect(create.status).toBe(201);
    expect(create.body.status).toBe(JournalEntryStatus.DRAFT);

    const post = await request(server)
      .post(`/api/accounting/journals/${create.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(post.status).toBe(201);
    expect(post.body.status).toBe(JournalEntryStatus.POSTED);
  });

  it('rejects unbalanced journal posting', async () => {
    const server = app.getHttpServer() as Server;
    const [cash, sales] = await requiredAccounts(['1010', '4000']);

    const create = await request(server)
      .post('/api/accounting/journals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        date: '2026-02-15T00:00:00.000Z',
        description: 'Unbalanced entry',
        lines: [
          { accountId: cash.id, debit: 90, credit: 0 },
          { accountId: sales.id, debit: 0, credit: 100 },
        ],
      });

    expect(create.status).toBe(201);

    const post = await request(server)
      .post(`/api/accounting/journals/${create.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(post.status).toBe(409);
  });

  it('blocks posting when period is closed', async () => {
    const server = app.getHttpServer() as Server;
    const [cash, sales] = await requiredAccounts(['1010', '4000']);

    await prisma.fiscalPeriod.upsert({
      where: {
        tenantId_year_month: {
          tenantId,
          year: 2026,
          month: 3,
        },
      },
      update: {
        status: FiscalPeriodStatus.CLOSED,
      },
      create: {
        tenantId,
        year: 2026,
        month: 3,
        status: FiscalPeriodStatus.CLOSED,
      },
    });

    const create = await request(server)
      .post('/api/accounting/journals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        date: '2026-03-15T00:00:00.000Z',
        description: 'Closed period entry',
        lines: [
          { accountId: cash.id, debit: 50, credit: 0 },
          { accountId: sales.id, debit: 0, credit: 50 },
        ],
      });

    expect(create.status).toBe(201);

    const post = await request(server)
      .post(`/api/accounting/journals/${create.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(post.status).toBe(409);
  });

  it('enforces tenant isolation for accounts and journals', async () => {
    const server = app.getHttpServer() as Server;

    const otherTenantAccount = await prisma.account.upsert({
      where: {
        tenantId_code: {
          tenantId: otherTenantId,
          code: '4010',
        },
      },
      update: {},
      create: {
        tenantId: otherTenantId,
        code: '4010',
        nameAr: 'مبيعات أخرى',
        nameEn: 'Other Tenant Sales',
        type: AccountType.REV,
        normalBalance: NormalBalance.CREDIT,
      },
    });

    const ownCash = await requiredAccounts(['1010']);

    const createWithForeignAccount = await request(server)
      .post('/api/accounting/journals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        date: '2026-02-18T00:00:00.000Z',
        description: 'Cross tenant account reference',
        lines: [
          { accountId: ownCash[0].id, debit: 100, credit: 0 },
          { accountId: otherTenantAccount.id, debit: 0, credit: 100 },
        ],
      });

    expect(createWithForeignAccount.status).toBe(404);

    const postForeignJournal = await request(server)
      .post(`/api/accounting/journals/${otherTenantJournalId}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();

    expect(postForeignJournal.status).toBe(404);
  });
});

async function requiredAccounts(codes: string[]) {
  const rows = await prisma.account.findMany({
    where: {
      tenantId,
      code: {
        in: codes,
      },
    },
    orderBy: {
      code: 'asc',
    },
  });

  const map = new Map(rows.map((row) => [row.code, row]));
  return codes.map((code) => {
    const account = map.get(code);
    if (!account) {
      throw new Error(`Missing account ${code}`);
    }

    return account;
  });
}

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

  const permissionKeys = ['accounting.read', 'accounting.manage'];
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

  const otherAccount = await prisma.account.upsert({
    where: {
      tenantId_code: {
        tenantId: otherTenantId,
        code: '1010',
      },
    },
    update: {},
    create: {
      tenantId: otherTenantId,
      code: '1010',
      nameAr: 'صندوق مستأجر آخر',
      nameEn: 'Other Tenant Cash',
      type: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
  });

  const otherJournal = await prisma.journalEntry.upsert({
    where: {
      tenantId_entryNo: {
        tenantId: otherTenantId,
        entryNo: 'JE-2026-999999',
      },
    },
    update: {},
    create: {
      tenantId: otherTenantId,
      entryNo: 'JE-2026-999999',
      date: new Date('2026-02-10T00:00:00.000Z'),
      description: 'Other tenant journal',
      status: JournalEntryStatus.DRAFT,
      lines: {
        create: [
          {
            tenantId: otherTenantId,
            accountId: otherAccount.id,
            debit: 10,
            credit: 0,
          },
          {
            tenantId: otherTenantId,
            accountId: otherAccount.id,
            debit: 0,
            credit: 10,
          },
        ],
      },
    },
  });

  return otherJournal.id;
}
