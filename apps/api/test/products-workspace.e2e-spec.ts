import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveOrionDatabaseUrl } from '../src/prisma/orion-database-url';

const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const tenantA = '11111111-1111-1111-1111-111111111111';
const tenantB = '99999999-9999-9999-9999-999999999999';
const branchA = '22222222-2222-2222-2222-222222222222';
const branchB = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const workspaceProductA = '77777777-7777-7777-7777-777777777771';
const workspaceProductB = '88888888-8888-8888-8888-888888888881';
const workspaceMessageContractKeys = [
  'activationReady',
  'activationBlocked',
  'alreadyActive',
  'staleConflictRejection',
  'recoveryGuidance',
  'mergeSummary',
  'approvalSummary',
  'handoffSummary',
  'activationSummary',
] as const;
const activationSummaryKeys = [
  'currentState',
  'pendingState',
  'changedState',
  'nextStep',
] as const;

let prisma: PrismaClient;

function expectExactKeys(actual: object, expectedKeys: readonly string[]) {
  expect(Object.keys(actual).sort()).toEqual([...expectedKeys].sort());
}

function expectWorkspaceMessageContractShape(messageContract: unknown) {
  expect(messageContract).toEqual(expect.any(Object));
  const contract = messageContract as Record<string, unknown>;

  expectExactKeys(contract, workspaceMessageContractKeys);
  expect(contract.activationReady).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.activationBlocked).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.alreadyActive).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.staleConflictRejection).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.recoveryGuidance).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.mergeSummary).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.approvalSummary).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.handoffSummary).toEqual(
    expect.objectContaining({
      en: expect.any(String),
      ar: expect.any(String),
    }),
  );
  expect(contract.activationSummary).toEqual(
    expect.objectContaining({
      currentState: expect.anything(),
      pendingState: expect.anything(),
      changedState: expect.anything(),
      nextStep: expect.anything(),
    }),
  );
  expectExactKeys(contract.activationSummary as object, activationSummaryKeys);
}

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

describe('Products workspace (e2e)', () => {
  let app: INestApplication;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    process.env.ORION_JWT_SECRET = 'ORION_products_workspace_stage89_secret';
    delete process.env.JWT_SECRET;
    ensureDatabaseUrl();
    prisma = new PrismaClient();
    await ensureWorkspaceFixtures();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    tokenA = await login('workspace-admin-a@orion.local', tenantA);
    tokenB = await login('workspace-admin-b@orion.local', tenantB);
  });

  beforeEach(async () => {
    await resetWorkspaceTenant({
      tenantId: tenantA,
    });
    await resetWorkspaceTenant({
      tenantId: tenantB,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('persists draft state across requests and blocks false activation', async () => {
    const server = app.getHttpServer() as Server;
    const testBarcode = `ORION-WORKSPACE-STAGE89-A-${Date.now()}`;

    const initial = await getWorkspace(server, tokenA, tenantA);

    expect(initial.status).toBe(200);
    expect(initial.body.draft.status).toBe('EMPTY');
    expectWorkspaceMessageContractShape(initial.body.messageContract);
    expect(initial.body.messageContract.activationSummary).toMatchObject({
      currentState: expect.objectContaining({
        en: 'Promotion is required before activation can run.',
        ar: expect.any(String),
      }),
      pendingState: expect.objectContaining({
        en: 'No activation is pending until the draft is promoted into catalog.',
        ar: expect.any(String),
      }),
      changedState: expect.objectContaining({
        en: 'No catalog product is ready for activation yet.',
        ar: expect.any(String),
      }),
      nextStep: expect.objectContaining({
        en: 'Promote the working draft into catalog first.',
        ar: expect.any(String),
      }),
    });

    const saveCore = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: initial.body.draft.updatedAt,
        nameAr: 'منتج مساحة العمل',
        nameEn: 'Workspace Product',
        strength: '500mg',
        packSize: '20 tablets',
      });

    expect(saveCore.status).toBe(200);

    const afterCore = await getWorkspace(server, tokenA, tenantA);

    expect(afterCore.status).toBe(200);
    expect(afterCore.body.draft.status).toBe('REVIEWABLE');
    expect(afterCore.body.draft.readiness.missingForCatalog).toContain(
      'Capture barcode',
    );

    const invalidActivate = await request(server)
      .post('/api/products/workspace/draft/activate')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: afterCore.body.draft.updatedAt,
        expectedCatalogUpdatedAt:
          afterCore.body.draft.concurrency.expectedCatalogUpdatedAt,
      });

    expect(invalidActivate.status).toBe(409);
    expect(invalidActivate.body.conflictType).toBe(
      'ACTIVATION_PREREQUISITES_NOT_MET',
    );
    expect(invalidActivate.body.message).toContain('before activation');
    expect(invalidActivate.body.messageContract).toMatchObject({
      staleConflictRejection: expect.objectContaining({
        en: expect.any(String),
        ar: expect.any(String),
      }),
      activationBlocked: expect.objectContaining({
        en: expect.any(String),
        ar: expect.any(String),
      }),
      recoveryGuidance: expect.objectContaining({
        en: expect.any(String),
        ar: expect.any(String),
      }),
    });

    const saveBarcode = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: afterCore.body.draft.updatedAt,
        barcode: testBarcode,
      });

    expect(saveBarcode.status).toBe(200);

    const afterBarcode = await getWorkspace(server, tokenA, tenantA);

    expect(afterBarcode.status).toBe(200);
    expect(afterBarcode.body.draft.status).toBe('READY_TO_PROMOTE');
    expect(afterBarcode.body.draft.readiness.missingForCatalog).toEqual([]);
  });

  it('promotes, activates, stores worklists, and records server-backed history', async () => {
    const server = app.getHttpServer() as Server;
    const testBarcode = `ORION-WORKSPACE-STAGE89-B-${Date.now()}`;
    const initial = await getWorkspace(server, tokenA, tenantA);

    const prepareReadyDraft = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: initial.body.draft.updatedAt,
        nameAr: 'منتج مساحة العمل',
        nameEn: 'Workspace Product',
        strength: '500mg',
        packSize: '20 tablets',
        barcode: testBarcode,
      });

    expect(prepareReadyDraft.status).toBe(200);
    expect(prepareReadyDraft.body.draft.status).toBe('READY_TO_PROMOTE');

    const readySnapshot = await getWorkspace(server, tokenA, tenantA);
    const promote = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: readySnapshot.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          readySnapshot.body.draft.concurrency.expectedBasedOnUpdatedAt,
        confirmed: true,
        plan: readySnapshot.body.promotion.executionPlan,
      });

    expect(promote.status).toBe(201);
    expect(promote.body.draft.status).toBe('PROMOTED_INACTIVE');
    expect(promote.body.draft.catalogProductId).toBeTruthy();
    expectWorkspaceMessageContractShape(promote.body.messageContract);
    expect(promote.body.activation).toMatchObject({
      ready: true,
      currentState: 'Catalog product is listed but inactive.',
      pendingState: 'Activation is ready to be executed.',
    });
    expect(promote.body.handoff).toMatchObject({
      expectedDecision: 'NONE',
      nextStep:
        'Activate when the product is truly launch-ready. If activation is blocked, refresh workspace truth, clear blockers, then retry activation.',
    });
    expect(promote.body.messageContract.activationSummary).toMatchObject({
      currentState: expect.objectContaining({
        en: 'Catalog product is listed but inactive.',
        ar: expect.any(String),
      }),
      pendingState: expect.objectContaining({
        en: 'Activation is ready to be executed.',
        ar: expect.any(String),
      }),
      changedState: expect.objectContaining({
        en: 'Activation changes the catalog-listed product from inactive to active.',
        ar: expect.any(String),
      }),
      nextStep: expect.objectContaining({
        en: 'Activate when the product is truly launch-ready',
        ar: expect.any(String),
      }),
    });
    expect(promote.body.activation.confirmation).toBeNull();

    const activate = await request(server)
      .post('/api/products/workspace/draft/activate')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: promote.body.draft.updatedAt,
        expectedCatalogUpdatedAt:
          promote.body.draft.concurrency.expectedCatalogUpdatedAt,
      });

    expect(activate.status).toBe(201);
    expect(activate.body.draft.status).toBe('PROMOTED_ACTIVE');
    expectWorkspaceMessageContractShape(activate.body.messageContract);
    expect(activate.body.activation).toMatchObject({
      ready: false,
      currentState: 'Catalog product is active now.',
      pendingState: 'No activation is pending.',
      changedState:
        'Activation is already completed and the catalog product remains active.',
    });
    expect(activate.body.mergeDecision.nextStep).toBe(
      'Keep active or return the draft to planning mode before editing',
    );
    expect(activate.body.approval.nextStep).toBe(
      'Keep active or return the draft to planning mode before editing',
    );
    expect(activate.body.promotion.confirmation.activeState).toBe(
      'Catalog product is already active. Promotion remains recorded for traceability.',
    );
    expect(activate.body.handoff).toMatchObject({
      expectedDecision: 'NONE',
      nextStep:
        'Keep active or deactivate to return to planning mode before editing',
    });
    expect(activate.body.messageContract.activationSummary).toMatchObject({
      currentState: expect.objectContaining({
        en: 'Catalog product is active now.',
        ar: expect.any(String),
      }),
      pendingState: expect.objectContaining({
        en: 'No activation is pending.',
        ar: expect.any(String),
      }),
      changedState: expect.objectContaining({
        en: 'Activation is already completed and the catalog product remains active.',
        ar: expect.any(String),
      }),
      nextStep: expect.objectContaining({
        en: 'Deactivate the catalog product if you need to change its launch state.',
        ar: expect.any(String),
      }),
    });
    expect(activate.body.activation.confirmation).toMatchObject({
      activatedProductId: activate.body.draft.catalogProductId,
      currentState: 'Catalog product is active now.',
      pendingState: 'No activation is pending.',
      finalState: 'Catalog product is active.',
    });

    const refreshedAfterActivate = await getWorkspace(server, tokenA, tenantA);
    expect(refreshedAfterActivate.body.activation.confirmation).toMatchObject({
      activatedProductId: activate.body.draft.catalogProductId,
      currentState: 'Catalog product is active now.',
      pendingState: 'No activation is pending.',
    });
    expect(refreshedAfterActivate.body.promotion.confirmation).toMatchObject({
      promotedProductId: activate.body.draft.catalogProductId,
      targetState: 'PROMOTED_INACTIVE',
    });
    expect(refreshedAfterActivate.body.handoff).toMatchObject({
      expectedDecision: 'NONE',
      nextStep:
        'Keep active or deactivate to return to planning mode before editing',
    });
    expect(
      refreshedAfterActivate.body.messageContract.activationSummary,
    ).toMatchObject({
      currentState: expect.objectContaining({
        en: 'Catalog product is active now.',
        ar: expect.any(String),
      }),
      pendingState: expect.objectContaining({
        en: 'No activation is pending.',
        ar: expect.any(String),
      }),
      changedState: expect.objectContaining({
        en: 'Activation is already completed and the catalog product remains active.',
        ar: expect.any(String),
      }),
      nextStep: expect.objectContaining({
        en: 'Deactivate the catalog product if you need to change its launch state.',
        ar: expect.any(String),
      }),
    });
    expect(refreshedAfterActivate.body.mergeDecision.nextStep).toBe(
      'Keep active or return the draft to planning mode before editing',
    );
    expect(refreshedAfterActivate.body.approval.nextStep).toBe(
      'Keep active or return the draft to planning mode before editing',
    );
    expectWorkspaceMessageContractShape(
      refreshedAfterActivate.body.messageContract,
    );

    const repeatActivate = await request(server)
      .post('/api/products/workspace/draft/activate')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: activate.body.draft.updatedAt,
        expectedCatalogUpdatedAt:
          activate.body.draft.concurrency.expectedCatalogUpdatedAt,
      });

    expect(repeatActivate.status).toBe(409);
    expect(repeatActivate.body.conflictType).toBe(
      'ACTIVATION_ALREADY_EXECUTED',
    );

    const flagDraft = await request(server)
      .post('/api/products/workspace/flags')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: activate.body.draft.updatedAt,
        action: 'PRIORITIZE',
        recordKeys: ['draft'],
      });

    expect(flagDraft.status).toBe(201);
    expect(
      flagDraft.body.recordStates.find(
        (state: { recordKey: string }) => state.recordKey === 'draft',
      ),
    ).toMatchObject({
      queued: true,
      prioritized: true,
      reviewed: false,
    });

    const saveWorklist = await request(server)
      .post('/api/products/workspace/worklists')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: flagDraft.body.draft.updatedAt,
        name: 'Ready launch check',
        query: 'workspace',
        filter: 'ACTIVE',
        selectedKeys: ['draft'],
        focusedKey: 'draft',
        scopeSummary: 'Focused draft launch check',
      });

    expect(saveWorklist.status).toBe(201);
    expect(saveWorklist.body.worklists).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Ready launch check',
          selectedKeys: ['draft'],
        }),
      ]),
    );

    const historyLabels = saveWorklist.body.history.map(
      (entry: { label: string }) => entry.label,
    );
    expect(historyLabels).toContain('Moved working draft into catalog');
    expect(historyLabels).toContain('Activated catalog product');
    expect(historyLabels).toContain('Saved worklist "Ready launch check"');
  });

  it('keeps draft, references, and worklists tenant-safe', async () => {
    const server = app.getHttpServer() as Server;

    const workspaceA = await getWorkspace(server, tokenA, tenantA);
    expect(workspaceA.status).toBe(200);

    const workspaceB = await getWorkspace(server, tokenB, tenantB);
    expect(workspaceB.status).toBe(200);

    const tenantAReferenceIds = workspaceA.body.references.map(
      (item: { id: string }) => item.id,
    );
    const tenantBReferenceIds = workspaceB.body.references.map(
      (item: { id: string }) => item.id,
    );

    expect(tenantAReferenceIds).toContain(workspaceProductA);
    expect(tenantAReferenceIds).not.toContain(workspaceProductB);
    expect(tenantBReferenceIds).toContain(workspaceProductB);
    expect(tenantBReferenceIds).not.toContain(workspaceProductA);
    expect(workspaceB.body.worklists).toHaveLength(0);

    const crossTenantBarcode = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-tenant-id', tenantB)
      .send({
        expectedDraftUpdatedAt: workspaceB.body.draft.updatedAt,
        nameAr: 'باركود عبر مستأجر مختلف',
        nameEn: 'Cross Tenant Barcode',
        strength: '10mg',
        packSize: '1 box',
        barcode: 'ORION-WORKSPACE-REF-A',
      });

    expect(crossTenantBarcode.status).toBe(200);
    expect(crossTenantBarcode.body.draft.barcode).toBe('ORION-WORKSPACE-REF-A');
    expect(crossTenantBarcode.body.draft.duplicateBarcodeConflict).toBeNull();

    const invalidFlag = await request(server)
      .post('/api/products/workspace/flags')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-tenant-id', tenantB)
      .send({
        expectedDraftUpdatedAt: crossTenantBarcode.body.draft.updatedAt,
        action: 'QUEUE',
        recordKeys: [workspaceProductA],
      });

    expect(invalidFlag.status).toBe(400);
  });

  it('blocks duplicate barcode attempts with clear operator guidance', async () => {
    const server = app.getHttpServer() as Server;
    const initial = await getWorkspace(server, tokenA, tenantA);

    const duplicateAttempt = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: initial.body.draft.updatedAt,
        nameAr: 'محاولة تكرار باركود',
        nameEn: 'Duplicate Barcode Attempt',
        strength: '15mg',
        packSize: '14 capsules',
        barcode: 'ORION-WORKSPACE-REF-A',
      });

    expect(duplicateAttempt.status).toBe(409);
    expect(duplicateAttempt.body.message).toContain(
      'This barcode already belongs to another product in this tenant.',
    );
    expect(duplicateAttempt.body.conflictType).toBe('DUPLICATE_BARCODE');
    expect(duplicateAttempt.body.operatorSummary).toContain(
      'ORION-WORKSPACE-REF-A',
    );
    expect(Array.isArray(duplicateAttempt.body.nextSteps)).toBe(true);
    expect(duplicateAttempt.body.nextSteps.length).toBeGreaterThan(0);
  });

  it('blocks ambiguous promotion attempts until the execution plan is confirmed', async () => {
    const server = app.getHttpServer() as Server;
    const initial = await getWorkspace(server, tokenA, tenantA);

    const readySave = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: initial.body.draft.updatedAt,
        nameAr: 'جاهز للترقية',
        nameEn: 'Ready For Promote',
        strength: '20mg',
        packSize: '20 tablets',
        barcode: `ORION-WORKSPACE-STAGE812-REQ-${Date.now()}`,
      });

    expect(readySave.status).toBe(200);

    const readyWorkspace = await getWorkspace(server, tokenA, tenantA);
    const ambiguousPromote = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: readyWorkspace.body.draft.updatedAt,
      });

    expect(ambiguousPromote.status).toBe(409);
    expect(ambiguousPromote.body.conflictType).toBe(
      'PROMOTION_EXECUTION_REQUIRED',
    );
    expect(ambiguousPromote.body.recovery).toMatchObject({
      retrySafe: true,
      refreshRequired: false,
      reopenRequired: false,
      rollbackMode: 'NON_DESTRUCTIVE',
    });
    expect(ambiguousPromote.body.promotionPlan).toMatchObject({
      mode: 'PROMOTE_DRAFT',
      targetState: 'PROMOTED_INACTIVE',
    });
  });

  it('rejects stale promotion plans when the draft changes before execution', async () => {
    const server = app.getHttpServer() as Server;
    const initial = await getWorkspace(server, tokenA, tenantA);

    const readySave = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: initial.body.draft.updatedAt,
        nameAr: 'جاهز للترقية',
        nameEn: 'Ready For Promote',
        strength: '20mg',
        packSize: '20 tablets',
        barcode: `ORION-WORKSPACE-STAGE812-STALE-${Date.now()}`,
      });

    expect(readySave.status).toBe(200);

    const confirmedWorkspace = await getWorkspace(server, tokenA, tenantA);
    const confirmedPlan = confirmedWorkspace.body.promotion.executionPlan;

    const changedDraft = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: confirmedWorkspace.body.draft.updatedAt,
        nameEn: 'Ready For Promote Updated',
      });

    expect(changedDraft.status).toBe(200);

    const latestWorkspace = await getWorkspace(server, tokenA, tenantA);
    const stalePromote = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: latestWorkspace.body.draft.updatedAt,
        confirmed: true,
        plan: confirmedPlan,
      });

    expect(stalePromote.status).toBe(409);
    expect(stalePromote.body.conflictType).toBe('PROMOTION_PLAN_STALE');
    expect(stalePromote.body.recovery).toMatchObject({
      retrySafe: true,
      refreshRequired: true,
      reopenRequired: true,
      rollbackMode: 'NON_DESTRUCTIVE',
    });
    expect(stalePromote.body.message).toContain(
      'no longer matches the current workspace state',
    );
  });

  it('requires explicit merge decisions and approval, then persists handoff traceability', async () => {
    const server = app.getHttpServer() as Server;
    await getWorkspace(server, tokenA, tenantA);

    await prisma.productWorkspaceDraft.update({
      where: { tenantId: tenantA },
      data: {
        basedOnProductId: workspaceProductA,
        catalogProductId: null,
        nameAr: 'مرجع معدل',
        nameEn: 'Reference Merge Candidate',
        strength: '500mg',
        packSize: '12 tablets',
        barcode: 'ORION-WORKSPACE-REF-A',
        trackingMode: 'NONE',
      },
    });

    const linked = await getWorkspace(server, tokenA, tenantA);
    expect(linked.status).toBe(200);
    expect(linked.body.mergeDecision.hasDifferences).toBe(true);
    expect(linked.body.mergeDecision.pendingCount).toBeGreaterThan(0);

    const blockedPromote = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: linked.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          linked.body.draft.concurrency.expectedBasedOnUpdatedAt,
        confirmed: true,
        plan: linked.body.promotion.executionPlan,
      });

    expect(blockedPromote.status).toBe(409);
    expect(blockedPromote.body.conflictType).toBe('MERGE_DECISIONS_REQUIRED');
    expect(blockedPromote.body.recovery).toMatchObject({
      retrySafe: true,
      refreshRequired: false,
      reopenRequired: false,
      rollbackMode: 'NON_DESTRUCTIVE',
    });
    expect(blockedPromote.body.promotionPlan.mode).toBe('PROMOTE_DRAFT');

    const saveMergeDecisions = await request(server)
      .post('/api/products/workspace/draft/merge-decisions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: linked.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          linked.body.draft.concurrency.expectedBasedOnUpdatedAt,
        rationale: 'Keep strength from trusted reference.',
        decisions: [
          { fieldKey: 'nameAr', decision: 'APPLY_DRAFT' },
          { fieldKey: 'nameEn', decision: 'APPLY_DRAFT' },
          { fieldKey: 'strength', decision: 'KEEP_REFERENCE' },
        ],
      });

    expect(saveMergeDecisions.status).toBe(201);
    expect(saveMergeDecisions.body.mergeDecision.pendingCount).toBe(0);
    expect(saveMergeDecisions.body.mergeDecision.applyDraftCount).toBe(2);
    expect(saveMergeDecisions.body.mergeDecision.keepReferenceCount).toBe(1);

    const promoteNeedsApproval = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: saveMergeDecisions.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          saveMergeDecisions.body.draft.concurrency.expectedBasedOnUpdatedAt,
        confirmed: true,
        plan: saveMergeDecisions.body.promotion.executionPlan,
      });

    expect(promoteNeedsApproval.status).toBe(409);
    expect(promoteNeedsApproval.body.conflictType).toBe('APPROVAL_REQUIRED');

    const submitForApproval = await request(server)
      .post('/api/products/workspace/draft/approval')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: saveMergeDecisions.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          saveMergeDecisions.body.draft.concurrency.expectedBasedOnUpdatedAt,
        decision: 'SUBMIT_FOR_APPROVAL',
        note: 'Ready for approval.',
      });

    expect(submitForApproval.status).toBe(201);
    expect(submitForApproval.body.approval.status).toBe('PENDING_REVIEW');

    const approve = await request(server)
      .post('/api/products/workspace/draft/approval')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: submitForApproval.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          submitForApproval.body.draft.concurrency.expectedBasedOnUpdatedAt,
        decision: 'APPROVED',
        note: 'Approved for controlled promotion.',
      });

    expect(approve.status).toBe(201);
    expect(approve.body.approval.status).toBe('APPROVED');
    expect(approve.body.approval.lastDecision.decision).toBe('APPROVED');
    expect(approve.body.approval.lastDecision.decidedBy).toContain(
      'workspace-admin-a@orion.local',
    );

    const packageHandoff = await request(server)
      .post('/api/products/workspace/draft/handoff')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: approve.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          approve.body.draft.concurrency.expectedBasedOnUpdatedAt,
        expectedDecision: 'PROMOTE_DRAFT',
        note: 'Promotion can proceed with approved merge package.',
      });

    expect(packageHandoff.status).toBe(201);
    expect(packageHandoff.body.handoff.expectedDecision).toBe('PROMOTE_DRAFT');
    expect(Array.isArray(packageHandoff.body.handoff.changed)).toBe(true);
    expect(packageHandoff.body.handoff.changed.length).toBeGreaterThan(0);

    const historyLabels = packageHandoff.body.history.map(
      (entry: { label: string }) => entry.label,
    );
    expect(historyLabels).toContain(
      'Recorded merge decisions against reference',
    );
    expect(historyLabels).toContain('Submitted merge package for approval');
    expect(historyLabels).toContain('Approved merge package');
    expect(historyLabels).toContain('Packaged handoff summary');

    const promoteApproved = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: packageHandoff.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          packageHandoff.body.draft.concurrency.expectedBasedOnUpdatedAt,
        confirmed: true,
        plan: packageHandoff.body.promotion.executionPlan,
      });

    expect(promoteApproved.status).toBe(201);
    expect(promoteApproved.body.draft.status).toBe('PROMOTED_INACTIVE');
    expect(promoteApproved.body.promotion.confirmation).toMatchObject({
      promotedProductId: promoteApproved.body.draft.catalogProductId,
      targetState: 'PROMOTED_INACTIVE',
      nextStep: 'Activate when the product is truly launch-ready',
    });
    expect(
      promoteApproved.body.promotion.confirmation.changed.length,
    ).toBeGreaterThan(0);
    expect(promoteApproved.body.promotion.confirmation.finalState).toContain(
      'Promotion completed',
    );

    const refreshedWorkspace = await getWorkspace(server, tokenA, tenantA);
    expect(refreshedWorkspace.body.promotion.confirmation).toMatchObject({
      promotedProductId: promoteApproved.body.draft.catalogProductId,
      targetState: 'PROMOTED_INACTIVE',
      nextStep: 'Activate when the product is truly launch-ready',
    });
    expect(
      refreshedWorkspace.body.promotion.confirmation.changed.length,
    ).toBeGreaterThan(0);

    const mergedProduct = await prisma.product.findUnique({
      where: { id: promoteApproved.body.draft.catalogProductId as string },
    });
    expect(mergedProduct).toBeTruthy();
    expect(mergedProduct?.nameEn).toBe('Reference Merge Candidate');
    expect(mergedProduct?.strength).toBe('250mg');
  });

  it('reconciles reset planning state without stale promoted handoff guidance', async () => {
    const server = app.getHttpServer() as Server;
    const initial = await getWorkspace(server, tokenA, tenantA);
    const testBarcode = `ORION-WORKSPACE-STAGE818-RESET-${Date.now()}`;

    const readyDraft = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: initial.body.draft.updatedAt,
        nameAr: 'اختبار إعادة التخطيط',
        nameEn: 'Reset Planning Reconciliation',
        strength: '100mg',
        packSize: '30 tablets',
        barcode: testBarcode,
      });

    expect(readyDraft.status).toBe(200);
    expect(readyDraft.body.draft.status).toBe('READY_TO_PROMOTE');
    const readyWorkspace = await getWorkspace(server, tokenA, tenantA);

    const promote = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: readyWorkspace.body.draft.updatedAt,
        expectedBasedOnUpdatedAt:
          readyWorkspace.body.draft.concurrency.expectedBasedOnUpdatedAt,
        confirmed: true,
        plan: readyWorkspace.body.promotion.executionPlan,
      });

    expect(promote.status).toBe(201);
    expect(promote.body.draft.status).toBe('PROMOTED_INACTIVE');
    expect(promote.body.handoff).toMatchObject({
      expectedDecision: 'NONE',
      nextStep:
        'Activate when the product is truly launch-ready. If activation is blocked, refresh workspace truth, clear blockers, then retry activation.',
    });

    const activate = await request(server)
      .post('/api/products/workspace/draft/activate')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: promote.body.draft.updatedAt,
        expectedCatalogUpdatedAt:
          promote.body.draft.concurrency.expectedCatalogUpdatedAt,
      });

    expect(activate.status).toBe(201);
    expect(activate.body.draft.status).toBe('PROMOTED_ACTIVE');
    expect(activate.body.handoff).toMatchObject({
      expectedDecision: 'NONE',
      nextStep:
        'Keep active or deactivate to return to planning mode before editing',
    });

    const deactivate = await request(server)
      .post('/api/products/workspace/draft/deactivate')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: activate.body.draft.updatedAt,
        expectedCatalogUpdatedAt:
          activate.body.draft.concurrency.expectedCatalogUpdatedAt,
      });

    expect(deactivate.status).toBe(201);
    expect(deactivate.body.draft.status).toBe('PROMOTED_INACTIVE');

    const reset = await request(server)
      .post('/api/products/workspace/draft/reset')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: deactivate.body.draft.updatedAt,
        expectedCatalogUpdatedAt:
          deactivate.body.draft.concurrency.expectedCatalogUpdatedAt,
      });

    expect(reset.status).toBe(201);
    expect(reset.body.draft.status).toBe('READY_TO_PROMOTE');
    expect(reset.body.draft.catalogProductId).toBeNull();
    expect(reset.body.promotion.confirmation).toBeNull();
    expect(reset.body.handoff).toMatchObject({
      expectedDecision: 'PROMOTE_DRAFT',
      nextStep: 'Promote the working draft into catalog.',
    });
    expect(reset.body.activation).toMatchObject({
      currentState: 'Promotion is required before activation can run.',
      pendingState:
        'No activation is pending until the draft is promoted into catalog.',
    });
  });

  it('blocks stale draft writes when another operator saves first', async () => {
    const server = app.getHttpServer() as Server;
    const initial = await getWorkspace(server, tokenA, tenantA);
    const staleToken = initial.body.draft.updatedAt;

    const firstSave = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: staleToken,
        nameAr: 'تحديث أول',
        nameEn: 'First Save',
        strength: '30mg',
        packSize: '10 tablets',
        barcode: `ORION-WORKSPACE-STAGE810-${Date.now()}`,
      });

    expect(firstSave.status).toBe(200);

    const staleSave = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: staleToken,
        strength: '50mg',
      });

    expect(staleSave.status).toBe(409);
    expect(staleSave.body.conflictType).toBe('STALE_DRAFT');
    expect(staleSave.body.message).toContain(
      'The working draft changed before your action was saved.',
    );
    expect(staleSave.body.messageContract).toMatchObject({
      staleConflictRejection: expect.objectContaining({
        en: expect.any(String),
        ar: expect.any(String),
      }),
      recoveryGuidance: expect.objectContaining({
        en: expect.any(String),
        ar: expect.any(String),
      }),
    });
    expect(Array.isArray(staleSave.body.nextSteps)).toBe(true);
    expect(staleSave.body.nextSteps.length).toBeGreaterThan(0);
  });

  it('blocks stale promote actions instead of allowing silent overwrite', async () => {
    const server = app.getHttpServer() as Server;
    const initial = await getWorkspace(server, tokenA, tenantA);
    const barcode = `ORION-WORKSPACE-STAGE810-PROMOTE-${Date.now()}`;

    const readySave = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: initial.body.draft.updatedAt,
        nameAr: 'جاهز للترقية',
        nameEn: 'Ready For Promote',
        strength: '20mg',
        packSize: '20 tablets',
        barcode,
      });
    expect(readySave.status).toBe(200);

    const readySnapshot = await getWorkspace(server, tokenA, tenantA);
    const stalePromoteToken = readySnapshot.body.draft.updatedAt;

    const concurrentSave = await request(server)
      .patch('/api/products/workspace/draft')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: stalePromoteToken,
        strength: '25mg',
      });
    expect(concurrentSave.status).toBe(200);

    const stalePromote = await request(server)
      .post('/api/products/workspace/draft/promote')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-id', tenantA)
      .send({
        expectedDraftUpdatedAt: stalePromoteToken,
        expectedBasedOnUpdatedAt:
          readySnapshot.body.draft.concurrency.expectedBasedOnUpdatedAt,
      });

    expect(stalePromote.status).toBe(409);
    expect(stalePromote.body.conflictType).toBe('STALE_DRAFT');
    expect(stalePromote.body.message).toContain(
      'The working draft changed before your action was saved.',
    );
  });

  async function getWorkspace(server: Server, token: string, tenantId: string) {
    return request(server)
      .get('/api/products/workspace')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantId);
  }

  async function login(email: string, tenantId: string) {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({
        email,
        password: adminPassword,
        tenantId,
      })
      .set('x-tenant-id', tenantId);

    expect(response.status).toBe(201);
    return response.body.access_token as string;
  }
});

async function ensureWorkspaceFixtures() {
  await ensureTenantFixture({
    tenantId: tenantA,
    branchId: branchA,
    userEmail: 'workspace-admin-a@orion.local',
    productId: workspaceProductA,
    barcode: 'ORION-WORKSPACE-REF-A',
    nameEn: 'Workspace Reference A',
    nameAr: 'مرجع مساحة العمل أ',
  });

  await ensureTenantFixture({
    tenantId: tenantB,
    branchId: branchB,
    userEmail: 'workspace-admin-b@orion.local',
    productId: workspaceProductB,
    barcode: 'ORION-WORKSPACE-REF-B',
    nameEn: 'Workspace Reference B',
    nameAr: 'مرجع مساحة العمل ب',
  });
}

async function resetWorkspaceTenant(params: { tenantId: string }) {
  await prisma.productWorkspaceWorklist.deleteMany({
    where: { tenantId: params.tenantId },
  });

  await prisma.productWorkspaceRecordState.deleteMany({
    where: { tenantId: params.tenantId },
  });

  await prisma.auditLog.deleteMany({
    where: {
      tenantId: params.tenantId,
      action: {
        startsWith: 'products.workspace.',
      },
    },
  });

  await prisma.productWorkspaceDraft.deleteMany({
    where: { tenantId: params.tenantId },
  });
}

async function ensureTenantFixture(params: {
  tenantId: string;
  branchId: string;
  userEmail: string;
  productId: string;
  barcode: string;
  nameEn: string;
  nameAr: string;
}) {
  await prisma.tenant.upsert({
    where: { id: params.tenantId },
    update: {},
    create: {
      id: params.tenantId,
      name: `Workspace Tenant ${params.tenantId.slice(0, 4)}`,
      subscriptionPlan: 'enterprise',
    },
  });

  const role = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: params.tenantId,
        name: 'admin',
      },
    },
    update: {},
    create: {
      tenantId: params.tenantId,
      name: 'admin',
    },
  });

  for (const key of ['products.read', 'products.manage']) {
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
    where: { id: params.branchId },
    update: {
      tenantId: params.tenantId,
      name: `Branch ${params.branchId.slice(0, 4)}`,
      location: 'Amman',
    },
    create: {
      id: params.branchId,
      tenantId: params.tenantId,
      name: `Branch ${params.branchId.slice(0, 4)}`,
      location: 'Amman',
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: params.userEmail },
    update: {
      tenantId: params.tenantId,
      branchId: params.branchId,
      roleId: role.id,
      passwordHash,
      isActive: true,
    },
    create: {
      tenantId: params.tenantId,
      branchId: params.branchId,
      roleId: role.id,
      email: params.userEmail,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.product.upsert({
    where: {
      tenantId_barcode: {
        tenantId: params.tenantId,
        barcode: params.barcode,
      },
    },
    update: {
      id: params.productId,
      nameAr: params.nameAr,
      nameEn: params.nameEn,
      strength: '250mg',
      packSize: '12 tablets',
      trackingMode: 'NONE',
      isActive: true,
    },
    create: {
      id: params.productId,
      tenantId: params.tenantId,
      nameAr: params.nameAr,
      nameEn: params.nameEn,
      barcode: params.barcode,
      strength: '250mg',
      packSize: '12 tablets',
      trackingMode: 'NONE',
      isActive: true,
    },
  });
}
