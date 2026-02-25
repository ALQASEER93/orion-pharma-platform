import { PostingRuleSetStatus } from '@prisma/client';
import { AccountingPostingService } from './accounting-posting.service';

describe('AccountingPostingService', () => {
  const prisma = {
    postingRuleSet: {
      findMany: jest.fn(),
    },
    postingRule: {
      findMany: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
    },
  };

  let service: AccountingPostingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountingPostingService(prisma as never);
  });

  it('resolves active rule set by effective date and applies rule priority order', async () => {
    prisma.postingRuleSet.findMany.mockResolvedValue([
      {
        id: 'rs-v2',
        name: 'sales',
        version: 2,
        status: PostingRuleSetStatus.ACTIVE,
        effectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
        effectiveTo: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        id: 'rs-v1',
        name: 'sales',
        version: 1,
        status: PostingRuleSetStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    prisma.postingRule.findMany.mockResolvedValue([
      {
        id: 'r-high',
        tenantId: 'tenant-1',
        ruleSetId: 'rs-v2',
        eventType: 'SALES_POSTED',
        priority: 100,
        debitAccountCode: '1010',
        creditAccountCode: '4000',
        amountExpr: 'grandTotal',
        memoTemplate: null,
        conditionsJson: null,
        isActive: true,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'r-low',
        tenantId: 'tenant-1',
        ruleSetId: 'rs-v2',
        eventType: 'SALES_POSTED',
        priority: 10,
        debitAccountCode: '5000',
        creditAccountCode: '1200',
        amountExpr: 'costTotal',
        memoTemplate: null,
        conditionsJson: null,
        isActive: true,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    const resolved = await service.resolveRules(
      'tenant-1',
      'SALES_POSTED',
      new Date('2026-05-01T00:00:00.000Z'),
      { grandTotal: 100, costTotal: 60 },
    );

    expect(resolved.selectedRuleSet.id).toBe('rs-v2');
    expect(resolved.matchedRules.map((rule) => rule.id)).toEqual([
      'r-high',
      'r-low',
    ]);
  });

  it('simulates deterministic journal preview', async () => {
    prisma.postingRuleSet.findMany.mockResolvedValue([
      {
        id: 'rs-v1',
        name: 'sales',
        version: 1,
        status: PostingRuleSetStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    prisma.postingRule.findMany.mockResolvedValue([
      {
        id: 'r-1',
        tenantId: 'tenant-1',
        ruleSetId: 'rs-v1',
        eventType: 'SALES_POSTED',
        priority: 50,
        debitAccountCode: '1010',
        creditAccountCode: '4000',
        amountExpr: 'round(grandTotal - discountTotal, 2)',
        memoTemplate: 'Invoice {{invoiceNo}}',
        conditionsJson: null,
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    prisma.account.findMany.mockResolvedValue([
      { code: '1010' },
      { code: '4000' },
    ]);

    const preview = await service.simulate({
      tenantId: 'tenant-1',
      eventType: 'SALES_POSTED',
      payload: { grandTotal: 120, discountTotal: 20, invoiceNo: 'INV-1' },
      effectiveAt: new Date('2026-02-01T00:00:00.000Z'),
      branchId: 'branch-1',
    });

    expect(preview.balanced).toBe(true);
    expect(preview.totals.debit).toBe(100);
    expect(preview.totals.credit).toBe(100);
    expect(preview.journalPreview.lines).toHaveLength(2);
    expect(preview.journalPreview.lines[0]).toMatchObject({
      accountCode: '1010',
      debit: 100,
      credit: 0,
      memo: 'Invoice INV-1',
      branchId: 'branch-1',
    });
  });
});
