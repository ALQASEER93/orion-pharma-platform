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
  PeriodCloseStatus,
  PostingRuleSetStatus,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const tenantId = '11111111-1111-1111-1111-111111111111';
const otherTenantId = '99999999-9999-9999-9999-999999999999';
const otherTenantPeriodId = '88888888-8888-8888-8888-888888888888';
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
  let otherTenantRuleSetId = '';
  let otherTenantPeriodFixtureId = '';
  const uniqueRunId = `${Date.now()}`;

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_e2e_test_secret_value_123456';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    const fixture = await ensureFixture();
    otherTenantJournalId = fixture.otherTenantJournalId;
    otherTenantRuleSetId = fixture.otherTenantRuleSetId;
    otherTenantPeriodFixtureId = fixture.otherTenantPeriodId;

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

  it('creates v1 ruleset, activates, then simulates deterministic preview', async () => {
    const server = app.getHttpServer() as Server;

    const createRuleSet = await request(server)
      .post('/api/accounting/posting-rulesets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        name: `SALES_POSTED_${uniqueRunId}`,
        version: 1,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: '2026-06-01T00:00:00.000Z',
      });

    expect(createRuleSet.status).toBe(201);

    const addRule = await request(server)
      .post('/api/accounting/posting-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        ruleSetId: createRuleSet.body.id,
        eventType: 'SALES_POSTED',
        priority: 100,
        debitAccountCode: '1010',
        creditAccountCode: '4000',
        amountExpr: 'grandTotal - discountTotal',
        memoTemplate: 'Sales {{invoiceNo}}',
        conditionsJson: { channel: 'POS' },
      });

    expect(addRule.status).toBe(201);
    await deactivateActiveRuleSets(
      server,
      createRuleSet.body.id as string,
      accessToken,
    );

    const activate = await request(server)
      .patch(`/api/accounting/posting-rulesets/${createRuleSet.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        status: PostingRuleSetStatus.ACTIVE,
      });

    expect(activate.status).toBe(200);
    expect(activate.body.status).toBe(PostingRuleSetStatus.ACTIVE);

    const preview = await request(server)
      .post('/api/accounting/posting-rules/simulate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        eventType: 'SALES_POSTED',
        effectiveAt: '2026-03-01T00:00:00.000Z',
        branchId,
        payload: {
          grandTotal: 120,
          discountTotal: 20,
          channel: 'POS',
          invoiceNo: 'INV-1001',
        },
      });

    expect(preview.status).toBe(201);
    expect(preview.body.selectedRuleSet.version).toBe(1);
    expect(preview.body.matchedRules).toHaveLength(1);
    expect(preview.body.totals).toEqual({ debit: 100, credit: 100 });
    expect(preview.body.balanced).toBe(true);
    expect(preview.body.journalPreview.lines[0]).toMatchObject({
      accountCode: '1010',
      debit: 100,
      credit: 0,
      memo: 'Sales INV-1001',
      branchId,
    });
  });

  it('selects ruleset version by effective date', async () => {
    const server = app.getHttpServer() as Server;
    const ruleSetName = `PURCHASE_GRN_${uniqueRunId}`;

    const createV1 = await request(server)
      .post('/api/accounting/posting-rulesets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        name: ruleSetName,
        version: 1,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: '2026-07-01T00:00:00.000Z',
      });
    expect(createV1.status).toBe(201);

    const ruleV1 = await request(server)
      .post('/api/accounting/posting-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        ruleSetId: createV1.body.id,
        eventType: 'PURCHASE_GRN_POSTED',
        priority: 50,
        debitAccountCode: '1200',
        creditAccountCode: '2000',
        amountExpr: 'baseAmount',
      });
    expect(ruleV1.status).toBe(201);

    await deactivateActiveRuleSets(
      server,
      createV1.body.id as string,
      accessToken,
    );

    const activateV1 = await request(server)
      .patch(`/api/accounting/posting-rulesets/${createV1.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        status: PostingRuleSetStatus.ACTIVE,
      });
    expect(activateV1.status).toBe(200);

    const createV2 = await request(server)
      .post('/api/accounting/posting-rulesets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        name: ruleSetName,
        version: 2,
        effectiveFrom: '2026-07-01T00:00:00.000Z',
      });
    expect(createV2.status).toBe(201);

    const ruleV2 = await request(server)
      .post('/api/accounting/posting-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        ruleSetId: createV2.body.id,
        eventType: 'PURCHASE_GRN_POSTED',
        priority: 50,
        debitAccountCode: '1200',
        creditAccountCode: '2000',
        amountExpr: 'baseAmount + taxAmount',
      });
    expect(ruleV2.status).toBe(201);

    const activateV2 = await request(server)
      .patch(`/api/accounting/posting-rulesets/${createV2.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        status: PostingRuleSetStatus.ACTIVE,
      });
    expect(activateV2.status).toBe(200);

    const previewV1Date = await request(server)
      .post('/api/accounting/posting-rules/simulate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        eventType: 'PURCHASE_GRN_POSTED',
        effectiveAt: '2026-06-15T00:00:00.000Z',
        payload: {
          baseAmount: 200,
          taxAmount: 30,
        },
      });

    expect(previewV1Date.status).toBe(201);
    expect(previewV1Date.body.selectedRuleSet.version).toBe(1);
    expect(previewV1Date.body.totals.debit).toBe(200);

    const previewV2Date = await request(server)
      .post('/api/accounting/posting-rules/simulate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        eventType: 'PURCHASE_GRN_POSTED',
        effectiveAt: '2026-08-15T00:00:00.000Z',
        payload: {
          baseAmount: 200,
          taxAmount: 30,
        },
      });

    expect(previewV2Date.status).toBe(201);
    expect(previewV2Date.body.selectedRuleSet.version).toBe(2);
    expect(previewV2Date.body.totals.debit).toBe(230);
  });

  it('enforces tenant isolation for posting rules endpoints', async () => {
    const server = app.getHttpServer() as Server;

    const listOther = await request(server)
      .get('/api/accounting/posting-rules')
      .query({ ruleSetId: otherTenantRuleSetId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(listOther.status).toBe(404);

    const patchOther = await request(server)
      .patch(`/api/accounting/posting-rulesets/${otherTenantRuleSetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ status: PostingRuleSetStatus.ACTIVE });
    expect(patchOther.status).toBe(404);
  });

  it('blocks period close when draft journals exist for the period', async () => {
    const server = app.getHttpServer() as Server;
    const [cash, sales] = await requiredAccounts(['1010', '4000']);
    const closeDraftYear = 2100 + Number(uniqueRunId.slice(-2));

    const period = await prisma.fiscalPeriod.upsert({
      where: {
        tenantId_year_month: {
          tenantId,
          year: closeDraftYear,
          month: 5,
        },
      },
      update: {
        status: FiscalPeriodStatus.OPEN,
      },
      create: {
        tenantId,
        year: closeDraftYear,
        month: 5,
        status: FiscalPeriodStatus.OPEN,
      },
    });

    const draftJournal = await request(server)
      .post('/api/accounting/journals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        date: `${closeDraftYear}-05-10T00:00:00.000Z`,
        description: 'Draft prevents close',
        lines: [
          { accountId: cash.id, debit: 300, credit: 0, branchId },
          { accountId: sales.id, debit: 0, credit: 300, branchId },
        ],
      });
    expect(draftJournal.status).toBe(201);
    expect(draftJournal.body.status).toBe(JournalEntryStatus.DRAFT);

    const closeResponse = await request(server)
      .post(`/api/accounting/periods/${period.id}/close`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ notes: 'Attempt close with drafts' });
    expect(closeResponse.status).toBe(409);
  });

  it('closes period, provides snapshots, rejects posting in closed period, and reopens with audit', async () => {
    const server = app.getHttpServer() as Server;
    const [cash, sales] = await requiredAccounts(['1010', '4000']);
    const closeYear = 2200 + Number(uniqueRunId.slice(-2));

    const period = await prisma.fiscalPeriod.upsert({
      where: {
        tenantId_year_month: {
          tenantId,
          year: closeYear,
          month: 6,
        },
      },
      update: {
        status: FiscalPeriodStatus.OPEN,
      },
      create: {
        tenantId,
        year: closeYear,
        month: 6,
        status: FiscalPeriodStatus.OPEN,
      },
    });

    const createPostedJournal = await request(server)
      .post('/api/accounting/journals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        date: `${closeYear}-06-15T00:00:00.000Z`,
        description: 'Close period posted entry',
        sourceType: 'TEST',
        sourceId: `CLOSE-${uniqueRunId}`,
        branchId,
        lines: [
          { accountId: cash.id, debit: 250, credit: 0, branchId },
          { accountId: sales.id, debit: 0, credit: 250, branchId },
        ],
      });
    expect(createPostedJournal.status).toBe(201);

    const postJournal = await request(server)
      .post(`/api/accounting/journals/${createPostedJournal.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(postJournal.status).toBe(201);
    expect(postJournal.body.status).toBe(JournalEntryStatus.POSTED);

    const closePeriod = await request(server)
      .post(`/api/accounting/periods/${period.id}/close`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ notes: 'Month-end close run' });
    expect(closePeriod.status).toBe(201);
    expect(closePeriod.body.status).toBe(FiscalPeriodStatus.CLOSED);

    const trialBalance = await request(server)
      .get('/api/accounting/trial-balance')
      .query({ periodId: period.id })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(trialBalance.status).toBe(200);
    expect(trialBalance.body.fiscalPeriodId).toBe(period.id);
    const trialBalancePayload = trialBalance.body.payload as {
      totalCredit: number;
      totalDebit: number;
    };
    expect(trialBalancePayload.totalDebit).toBeCloseTo(
      trialBalancePayload.totalCredit,
      6,
    );

    const pl = await request(server)
      .get('/api/accounting/statements/pl')
      .query({ periodId: period.id })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(pl.status).toBe(200);
    expect(pl.body.type).toBe('PL');
    expect(pl.body.payload.netIncome).toBe(250);

    const bs = await request(server)
      .get('/api/accounting/statements/bs')
      .query({ periodId: period.id })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(bs.status).toBe(200);
    expect(bs.body.type).toBe('BS');
    expect(bs.body.payload.totals.retainedEarnings).toBe(250);

    const createAfterClose = await request(server)
      .post('/api/accounting/journals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        date: `${closeYear}-06-20T00:00:00.000Z`,
        description: 'Posting blocked after close',
        lines: [
          { accountId: cash.id, debit: 70, credit: 0, branchId },
          { accountId: sales.id, debit: 0, credit: 70, branchId },
        ],
      });
    expect(createAfterClose.status).toBe(201);

    const postAfterClose = await request(server)
      .post(`/api/accounting/journals/${createAfterClose.body.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send();
    expect(postAfterClose.status).toBe(409);

    const reopen = await request(server)
      .post(`/api/accounting/periods/${period.id}/reopen`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ notes: 'Audit-approved reopen for correction' });
    expect(reopen.status).toBe(201);
    expect(reopen.body.status).toBe(FiscalPeriodStatus.OPEN);

    const closeRevisions = await prisma.periodClose.findMany({
      where: {
        tenantId,
        fiscalPeriodId: period.id,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(
      closeRevisions.some(
        (revision) => revision.status === PeriodCloseStatus.CLOSED,
      ),
    ).toBe(true);
    expect(
      closeRevisions.some(
        (revision) => revision.status === PeriodCloseStatus.REOPENED,
      ),
    ).toBe(true);

    const reopenAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        action: 'PERIOD_REOPEN',
        entity: 'fiscal_periods',
        entityId: period.id,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    expect(reopenAudit).toBeTruthy();
  });

  it('enforces tenant isolation for close and statement endpoints', async () => {
    const server = app.getHttpServer() as Server;

    const closeOtherPeriod = await request(server)
      .post(`/api/accounting/periods/${otherTenantPeriodFixtureId}/close`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ notes: 'Cross tenant close attempt' });
    expect(closeOtherPeriod.status).toBe(404);

    const tbOtherPeriod = await request(server)
      .get('/api/accounting/trial-balance')
      .query({ periodId: otherTenantPeriodFixtureId })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);
    expect(tbOtherPeriod.status).toBe(404);

    const reopenOtherPeriod = await request(server)
      .post(`/api/accounting/periods/${otherTenantPeriodFixtureId}/reopen`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ notes: 'Cross tenant reopen attempt' });
    expect(reopenOtherPeriod.status).toBe(404);
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

async function deactivateActiveRuleSets(
  server: Server,
  keepRuleSetId: string,
  token: string,
) {
  const existingRuleSets = await request(server)
    .get('/api/accounting/posting-rulesets')
    .set('Authorization', `Bearer ${token}`)
    .set('x-tenant-id', tenantId);
  expect(existingRuleSets.status).toBe(200);

  for (const ruleSet of existingRuleSets.body as Array<{
    id: string;
    status: string;
  }>) {
    if (
      ruleSet.id === keepRuleSetId ||
      ruleSet.status !== PostingRuleSetStatus.ACTIVE
    ) {
      continue;
    }

    const deactivate = await request(server)
      .patch(`/api/accounting/posting-rulesets/${ruleSet.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantId)
      .send({ status: PostingRuleSetStatus.INACTIVE });
    expect(deactivate.status).toBe(200);
  }
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

  await prisma.fiscalPeriod.upsert({
    where: { id: otherTenantPeriodId },
    update: {
      tenantId: otherTenantId,
      year: 2026,
      month: 7,
      status: FiscalPeriodStatus.OPEN,
    },
    create: {
      id: otherTenantPeriodId,
      tenantId: otherTenantId,
      year: 2026,
      month: 7,
      status: FiscalPeriodStatus.OPEN,
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

  const otherRuleSet = await prisma.postingRuleSet.upsert({
    where: {
      tenantId_name_version: {
        tenantId: otherTenantId,
        name: 'OTHER_RULESET',
        version: 1,
      },
    },
    update: {
      status: PostingRuleSetStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
    create: {
      tenantId: otherTenantId,
      name: 'OTHER_RULESET',
      version: 1,
      status: PostingRuleSetStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
  });

  return {
    otherTenantJournalId: otherJournal.id,
    otherTenantRuleSetId: otherRuleSet.id,
    otherTenantPeriodId,
  };
}
