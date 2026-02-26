import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  FiscalPeriodStatus,
  JournalEntryStatus,
  NormalBalance,
  PeriodCloseStatus,
  PostingRuleSetStatus,
  Prisma,
  StatementType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingPostingService } from './accounting-posting.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreatePostingRuleDto } from './dto/create-posting-rule.dto';
import { CreatePostingRuleSetDto } from './dto/create-posting-ruleset.dto';
import { QueryJournalsDto } from './dto/query-journals.dto';
import { QueryPeriodReportDto } from './dto/query-period-report.dto';
import { QueryPostingRulesDto } from './dto/query-posting-rules.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { SimulatePostingRulesDto } from './dto/simulate-posting-rules.dto';
import { UpdatePostingRuleDto } from './dto/update-posting-rule.dto';
import { UpdatePostingRuleSetDto } from './dto/update-posting-ruleset.dto';
import {
  assertJournalLineValues,
  isBalanced,
} from './utils/journal-validation';
import { validateExpressionSyntax } from './utils/posting-expression';
import { rangesOverlap } from './utils/posting-rules';

const JOURNAL_SEQUENCE_KEY = 'JOURNAL_ENTRY';
const JOURNAL_POST_STAGE = 'JOURNAL_POST';
const CLOSE_TOLERANCE = 0.0001;

export type JournalPreviewLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string | null;
  branchId?: string;
};

const DEFAULT_COA: Array<{
  code: string;
  nameAr: string;
  nameEn: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isControl?: boolean;
}> = [
  {
    code: '1010',
    nameAr: 'الصندوق',
    nameEn: 'Cash on Hand',
    type: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isControl: true,
  },
  {
    code: '1100',
    nameAr: 'العملاء',
    nameEn: 'Accounts Receivable',
    type: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isControl: true,
  },
  {
    code: '1200',
    nameAr: 'المخزون',
    nameEn: 'Inventory',
    type: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isControl: true,
  },
  {
    code: '2000',
    nameAr: 'الموردون',
    nameEn: 'Accounts Payable',
    type: AccountType.LIAB,
    normalBalance: NormalBalance.CREDIT,
    isControl: true,
  },
  {
    code: '2100',
    nameAr: 'ضريبة المخرجات',
    nameEn: 'Output VAT Payable',
    type: AccountType.LIAB,
    normalBalance: NormalBalance.CREDIT,
    isControl: true,
  },
  {
    code: '4000',
    nameAr: 'المبيعات',
    nameEn: 'Sales Revenue',
    type: AccountType.REV,
    normalBalance: NormalBalance.CREDIT,
  },
  {
    code: '5000',
    nameAr: 'تكلفة البضاعة المباعة',
    nameEn: 'Cost of Goods Sold',
    type: AccountType.EXP,
    normalBalance: NormalBalance.DEBIT,
  },
  {
    code: '5100',
    nameAr: 'ضريبة المدخلات',
    nameEn: 'Input VAT Receivable',
    type: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isControl: true,
  },
];

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPostingService: AccountingPostingService,
  ) {}

  async listCoa(tenantId: string) {
    return this.prisma.account.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }],
    });
  }

  async seedDefaultCoa(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const seeded: Array<{ code: string; id: string }> = [];

      for (const account of DEFAULT_COA) {
        const row = await tx.account.upsert({
          where: {
            tenantId_code: {
              tenantId,
              code: account.code,
            },
          },
          update: {
            nameAr: account.nameAr,
            nameEn: account.nameEn,
            type: account.type,
            normalBalance: account.normalBalance,
            isControl: account.isControl ?? false,
            isActive: true,
          },
          create: {
            tenantId,
            code: account.code,
            nameAr: account.nameAr,
            nameEn: account.nameEn,
            type: account.type,
            normalBalance: account.normalBalance,
            isControl: account.isControl ?? false,
            isActive: true,
          },
        });

        seeded.push({ code: row.code, id: row.id });
      }

      return {
        seededCount: seeded.length,
        accounts: seeded,
      };
    });
  }

  async createJournal(tenantId: string, dto: CreateJournalDto) {
    this.validateJournalLines(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      if (dto.branchId) {
        await this.assertBranchInTenant(tx, tenantId, dto.branchId);
      }

      await this.assertAccountsInTenant(
        tx,
        tenantId,
        dto.lines.map((line) => line.accountId),
      );

      for (const line of dto.lines) {
        if (line.branchId) {
          await this.assertBranchInTenant(tx, tenantId, line.branchId);
        }
      }

      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key: JOURNAL_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId,
          key: JOURNAL_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });

      const sequenceNumber = sequence.nextNumber - 1;
      const entryNo = `JE-${new Date(dto.date).getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;

      const entryDate = new Date(dto.date);
      const year = entryDate.getUTCFullYear();
      const month = entryDate.getUTCMonth() + 1;

      const period = await tx.fiscalPeriod.findUnique({
        where: {
          tenantId_year_month: {
            tenantId,
            year,
            month,
          },
        },
      });

      const journal = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNo,
          date: entryDate,
          description: dto.description,
          status: JournalEntryStatus.DRAFT,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          branchId: dto.branchId,
          fiscalPeriodId: period?.id,
          lines: {
            create: dto.lines.map((line) => ({
              tenantId,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              memo: line.memo,
              branchId: line.branchId,
            })),
          },
        },
        include: {
          lines: true,
        },
      });

      return journal;
    });
  }

  async listJournals(tenantId: string, query: QueryJournalsDto) {
    return this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        lines: true,
      },
    });
  }

  async postJournal(tenantId: string, journalId: string) {
    return this.prisma.$transaction(async (tx) => {
      const journal = await tx.journalEntry.findFirst({
        where: {
          id: journalId,
          tenantId,
        },
        include: {
          lines: true,
        },
      });

      if (!journal) {
        throw new NotFoundException('Journal entry not found.');
      }

      if (journal.status === JournalEntryStatus.POSTED) {
        return journal;
      }

      if (journal.status !== JournalEntryStatus.DRAFT) {
        throw new ConflictException(
          'Only draft journal entries can be posted.',
        );
      }

      this.validateJournalLines(journal.lines);

      if (!isBalanced(journal.lines)) {
        throw new ConflictException('Journal entry is not balanced.');
      }

      const postingDate = new Date(journal.date);
      const period = await tx.fiscalPeriod.findUnique({
        where: {
          tenantId_year_month: {
            tenantId,
            year: postingDate.getUTCFullYear(),
            month: postingDate.getUTCMonth() + 1,
          },
        },
      });

      if (!period) {
        throw new ConflictException(
          'Fiscal period is not configured for posting date.',
        );
      }

      if (period.status !== FiscalPeriodStatus.OPEN) {
        throw new ConflictException('Fiscal period is closed or locked.');
      }

      if (journal.sourceType && journal.sourceId) {
        try {
          await tx.postingKey.create({
            data: {
              tenantId,
              sourceType: journal.sourceType,
              sourceId: journal.sourceId,
              stage: JOURNAL_POST_STAGE,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            const refreshed = await tx.journalEntry.findFirst({
              where: { id: journalId, tenantId },
              include: { lines: true },
            });

            if (refreshed?.status === JournalEntryStatus.POSTED) {
              return refreshed;
            }

            throw new ConflictException(
              'Posting key already used for this stage.',
            );
          }

          throw error;
        }
      }

      return tx.journalEntry.update({
        where: {
          id: journal.id,
        },
        data: {
          status: JournalEntryStatus.POSTED,
          fiscalPeriodId: period.id,
        },
        include: {
          lines: true,
        },
      });
    });
  }

  async closePeriod(
    tenantId: string,
    periodId: string,
    closedByUserId: string | undefined,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({
        where: {
          id: periodId,
          tenantId,
        },
      });
      if (!period) {
        throw new NotFoundException('Fiscal period not found.');
      }

      if (period.status !== FiscalPeriodStatus.OPEN) {
        throw new ConflictException('Fiscal period must be OPEN to close.');
      }

      const { startAt, endAt } = this.resolvePeriodWindow(period);
      const draftCount = await tx.journalEntry.count({
        where: {
          tenantId,
          status: JournalEntryStatus.DRAFT,
          OR: [
            { fiscalPeriodId: period.id },
            {
              date: {
                gte: startAt,
                lt: endAt,
              },
            },
          ],
        },
      });
      if (draftCount > 0) {
        throw new ConflictException(
          'Cannot close period with draft journals pending.',
        );
      }

      const { trialBalancePayload, statementPayloadByType } =
        await this.buildPeriodSnapshots(tx, tenantId, period.id, endAt);

      if (
        Math.abs(
          Number(trialBalancePayload.totalDebit) -
            Number(trialBalancePayload.totalCredit),
        ) > CLOSE_TOLERANCE
      ) {
        throw new ConflictException('Posted journals are not balanced.');
      }

      const closedAt = new Date();
      const updatedPeriod = await tx.fiscalPeriod.update({
        where: { id: period.id },
        data: {
          status: FiscalPeriodStatus.CLOSED,
        },
      });

      const closeRevision = await tx.periodClose.create({
        data: {
          tenantId,
          fiscalPeriodId: period.id,
          status: PeriodCloseStatus.CLOSED,
          closedAt,
          closedByUserId,
          notes,
        },
      });

      const tbSnapshot = await tx.trialBalanceSnapshot.create({
        data: {
          tenantId,
          fiscalPeriodId: period.id,
          asOfDate: endAt,
          payload: trialBalancePayload as Prisma.JsonObject,
        },
      });

      const plSnapshot = await tx.statementSnapshot.create({
        data: {
          tenantId,
          fiscalPeriodId: period.id,
          type: StatementType.PL,
          payload: statementPayloadByType.PL as Prisma.JsonObject,
        },
      });

      const bsSnapshot = await tx.statementSnapshot.create({
        data: {
          tenantId,
          fiscalPeriodId: period.id,
          type: StatementType.BS,
          payload: statementPayloadByType.BS as Prisma.JsonObject,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: closedByUserId,
          action: 'PERIOD_CLOSE',
          entity: 'fiscal_periods',
          entityId: period.id,
          before: { status: period.status },
          after: {
            status: FiscalPeriodStatus.CLOSED,
            periodCloseId: closeRevision.id,
            trialBalanceSnapshotId: tbSnapshot.id,
            plSnapshotId: plSnapshot.id,
            bsSnapshotId: bsSnapshot.id,
          },
        },
      });

      return {
        periodId: period.id,
        status: updatedPeriod.status,
        periodCloseId: closeRevision.id,
        trialBalanceSnapshotId: tbSnapshot.id,
        statementSnapshotIds: {
          PL: plSnapshot.id,
          BS: bsSnapshot.id,
        },
      };
    });
  }

  async reopenPeriod(
    tenantId: string,
    periodId: string,
    reopenedByUserId: string | undefined,
    dto: ReopenPeriodDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({
        where: {
          id: periodId,
          tenantId,
        },
      });
      if (!period) {
        throw new NotFoundException('Fiscal period not found.');
      }

      if (
        period.status !== FiscalPeriodStatus.CLOSED &&
        period.status !== FiscalPeriodStatus.LOCKED
      ) {
        throw new ConflictException(
          'Only CLOSED or LOCKED periods can reopen.',
        );
      }

      const updatedPeriod = await tx.fiscalPeriod.update({
        where: { id: period.id },
        data: {
          status: FiscalPeriodStatus.OPEN,
        },
      });

      const reopenRevision = await tx.periodClose.create({
        data: {
          tenantId,
          fiscalPeriodId: period.id,
          status: PeriodCloseStatus.REOPENED,
          closedAt: new Date(),
          closedByUserId: reopenedByUserId,
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: reopenedByUserId,
          action: 'PERIOD_REOPEN',
          entity: 'fiscal_periods',
          entityId: period.id,
          before: { status: period.status },
          after: {
            status: FiscalPeriodStatus.OPEN,
            periodCloseId: reopenRevision.id,
            notes: dto.notes ?? null,
          },
        },
      });

      return {
        periodId: period.id,
        status: updatedPeriod.status,
        periodCloseId: reopenRevision.id,
      };
    });
  }

  async getTrialBalanceSnapshot(tenantId: string, query: QueryPeriodReportDto) {
    await this.assertPeriodInTenant(tenantId, query.periodId);

    const snapshot = await this.prisma.trialBalanceSnapshot.findFirst({
      where: {
        tenantId,
        fiscalPeriodId: query.periodId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!snapshot) {
      throw new NotFoundException('Trial balance snapshot not found.');
    }

    return snapshot;
  }

  async getStatementSnapshot(
    tenantId: string,
    query: QueryPeriodReportDto,
    type: StatementType,
  ) {
    await this.assertPeriodInTenant(tenantId, query.periodId);

    const snapshot = await this.prisma.statementSnapshot.findFirst({
      where: {
        tenantId,
        fiscalPeriodId: query.periodId,
        type,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!snapshot) {
      throw new NotFoundException('Statement snapshot not found.');
    }

    return snapshot;
  }

  async listPostingRuleSets(tenantId: string) {
    return this.prisma.postingRuleSet.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }

  async createPostingRuleSet(
    tenantId: string,
    userId: string | undefined,
    dto: CreatePostingRuleSetDto,
  ) {
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    this.validateRuleSetWindow(effectiveFrom, effectiveTo);

    try {
      return await this.prisma.postingRuleSet.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          version: dto.version,
          status: PostingRuleSetStatus.DRAFT,
          effectiveFrom,
          effectiveTo,
          createdByUserId: userId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Posting rule set version already exists for tenant.',
        );
      }

      throw error;
    }
  }

  async updatePostingRuleSet(
    tenantId: string,
    ruleSetId: string,
    dto: UpdatePostingRuleSetDto,
  ) {
    const current = await this.prisma.postingRuleSet.findFirst({
      where: { id: ruleSetId, tenantId },
    });
    if (!current) {
      throw new NotFoundException('Posting rule set not found.');
    }

    if (
      current.status === PostingRuleSetStatus.ACTIVE &&
      (dto.effectiveFrom !== undefined || dto.effectiveTo !== undefined)
    ) {
      throw new ConflictException(
        'Active posting rule sets are immutable. Create a new version.',
      );
    }

    const effectiveFrom =
      dto.effectiveFrom !== undefined
        ? new Date(dto.effectiveFrom)
        : current.effectiveFrom;
    const effectiveTo =
      dto.effectiveTo !== undefined
        ? new Date(dto.effectiveTo)
        : current.effectiveTo;
    this.validateRuleSetWindow(effectiveFrom, effectiveTo);

    if (
      dto.status === PostingRuleSetStatus.ACTIVE &&
      current.status !== PostingRuleSetStatus.ACTIVE
    ) {
      await this.assertNoActiveRuleSetOverlap(
        tenantId,
        current.id,
        effectiveFrom,
        effectiveTo,
      );
    }

    return this.prisma.postingRuleSet.update({
      where: { id: current.id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
      },
    });
  }

  async listPostingRules(tenantId: string, query: QueryPostingRulesDto) {
    if (!query.ruleSetId) {
      throw new BadRequestException('ruleSetId query parameter is required.');
    }

    const ruleSet = await this.prisma.postingRuleSet.findFirst({
      where: {
        id: query.ruleSetId,
        tenantId,
      },
      select: { id: true },
    });
    if (!ruleSet) {
      throw new NotFoundException('Posting rule set not found.');
    }

    return this.prisma.postingRule.findMany({
      where: {
        tenantId,
        ruleSetId: query.ruleSetId,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async createPostingRule(tenantId: string, dto: CreatePostingRuleDto) {
    const ruleSet = await this.prisma.postingRuleSet.findFirst({
      where: {
        id: dto.ruleSetId,
        tenantId,
      },
    });
    if (!ruleSet) {
      throw new NotFoundException('Posting rule set not found.');
    }

    this.assertRuleSetMutable(ruleSet.status);
    validateExpressionSyntax(dto.amountExpr);
    await this.assertAccountCodesInTenant(tenantId, [
      dto.debitAccountCode,
      dto.creditAccountCode,
    ]);

    return this.prisma.postingRule.create({
      data: {
        tenantId,
        ruleSetId: dto.ruleSetId,
        eventType: dto.eventType.trim(),
        priority: dto.priority ?? 0,
        debitAccountCode: dto.debitAccountCode.trim(),
        creditAccountCode: dto.creditAccountCode.trim(),
        amountExpr: dto.amountExpr.trim(),
        memoTemplate: dto.memoTemplate,
        ...(dto.conditionsJson !== undefined
          ? { conditionsJson: dto.conditionsJson as Prisma.JsonObject }
          : {}),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePostingRule(
    tenantId: string,
    ruleId: string,
    dto: UpdatePostingRuleDto,
  ) {
    const rule = await this.prisma.postingRule.findFirst({
      where: { id: ruleId, tenantId },
      include: {
        ruleSet: {
          select: {
            status: true,
          },
        },
      },
    });
    if (!rule) {
      throw new NotFoundException('Posting rule not found.');
    }

    this.assertRuleSetMutable(rule.ruleSet.status);

    if (dto.amountExpr !== undefined) {
      validateExpressionSyntax(dto.amountExpr);
    }

    const debitAccountCode = dto.debitAccountCode ?? rule.debitAccountCode;
    const creditAccountCode = dto.creditAccountCode ?? rule.creditAccountCode;
    if (
      dto.debitAccountCode !== undefined ||
      dto.creditAccountCode !== undefined
    ) {
      await this.assertAccountCodesInTenant(tenantId, [
        debitAccountCode,
        creditAccountCode,
      ]);
    }

    return this.prisma.postingRule.update({
      where: { id: rule.id },
      data: {
        ...(dto.eventType !== undefined
          ? { eventType: dto.eventType.trim() }
          : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.debitAccountCode !== undefined
          ? { debitAccountCode: dto.debitAccountCode.trim() }
          : {}),
        ...(dto.creditAccountCode !== undefined
          ? { creditAccountCode: dto.creditAccountCode.trim() }
          : {}),
        ...(dto.amountExpr !== undefined
          ? { amountExpr: dto.amountExpr.trim() }
          : {}),
        ...(dto.memoTemplate !== undefined
          ? { memoTemplate: dto.memoTemplate }
          : {}),
        ...(dto.conditionsJson !== undefined
          ? { conditionsJson: dto.conditionsJson as Prisma.JsonObject }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async simulatePostingRules(tenantId: string, dto: SimulatePostingRulesDto) {
    const effectiveAt = dto.effectiveAt
      ? new Date(dto.effectiveAt)
      : new Date();
    if (dto.branchId) {
      await this.assertBranchInTenant(this.prisma, tenantId, dto.branchId);
    }

    return this.accountingPostingService.simulate({
      tenantId,
      eventType: dto.eventType,
      payload: dto.payload,
      effectiveAt,
      branchId: dto.branchId,
    });
  }

  async postJournalFromPreview(params: {
    tenantId: string;
    date: Date;
    description: string;
    sourceType: string;
    sourceId: string;
    lines: JournalPreviewLineInput[];
    defaultBranchId?: string;
    idempotencyStage?: string;
  }) {
    if (params.lines.length === 0) {
      return null;
    }

    this.validateJournalLines(
      params.lines.map((line) => ({ debit: line.debit, credit: line.credit })),
    );
    if (!isBalanced(params.lines)) {
      throw new ConflictException('Journal preview is not balanced.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (params.idempotencyStage) {
        try {
          await tx.postingKey.create({
            data: {
              tenantId: params.tenantId,
              sourceType: params.sourceType,
              sourceId: params.sourceId,
              stage: params.idempotencyStage,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            const existing = await tx.journalEntry.findFirst({
              where: {
                tenantId: params.tenantId,
                sourceType: params.sourceType,
                sourceId: params.sourceId,
                status: JournalEntryStatus.POSTED,
              },
              include: {
                lines: true,
              },
            });

            if (existing) {
              return existing;
            }

            throw new ConflictException('Posting key already consumed.');
          }

          throw error;
        }
      }

      const postingDate = new Date(params.date);
      if (Number.isNaN(postingDate.getTime())) {
        throw new BadRequestException('Posting date is invalid.');
      }

      const period = await tx.fiscalPeriod.findUnique({
        where: {
          tenantId_year_month: {
            tenantId: params.tenantId,
            year: postingDate.getUTCFullYear(),
            month: postingDate.getUTCMonth() + 1,
          },
        },
      });

      if (!period) {
        throw new ConflictException(
          'Fiscal period is not configured for posting date.',
        );
      }

      if (period.status !== FiscalPeriodStatus.OPEN) {
        throw new ConflictException('Fiscal period is closed or locked.');
      }

      const allBranchIds = [
        ...new Set(
          params.lines
            .map((line) => line.branchId ?? params.defaultBranchId)
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      for (const branchId of allBranchIds) {
        await this.assertBranchInTenant(tx, params.tenantId, branchId);
      }

      const accountCodes = [
        ...new Set(params.lines.map((line) => line.accountCode.trim())),
      ];
      const accounts = await tx.account.findMany({
        where: {
          tenantId: params.tenantId,
          isActive: true,
          code: {
            in: accountCodes,
          },
        },
        select: {
          id: true,
          code: true,
        },
      });
      if (accounts.length !== accountCodes.length) {
        throw new NotFoundException(
          'One or more account codes were not found in tenant.',
        );
      }
      const accountMap = new Map(
        accounts.map((account) => [account.code, account.id]),
      );

      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId: params.tenantId,
            key: JOURNAL_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId: params.tenantId,
          key: JOURNAL_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });

      const sequenceNumber = sequence.nextNumber - 1;
      const entryNo = `JE-${postingDate.getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;

      return tx.journalEntry.create({
        data: {
          tenantId: params.tenantId,
          entryNo,
          date: postingDate,
          description: params.description,
          status: JournalEntryStatus.POSTED,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          branchId: params.defaultBranchId,
          fiscalPeriodId: period.id,
          lines: {
            create: params.lines.map((line) => ({
              tenantId: params.tenantId,
              accountId: accountMap.get(line.accountCode.trim()) as string,
              debit: line.debit,
              credit: line.credit,
              memo: line.memo ?? undefined,
              branchId: line.branchId ?? params.defaultBranchId,
            })),
          },
        },
        include: {
          lines: true,
        },
      });
    });
  }

  private validateJournalLines(
    lines: Array<{ debit: number; credit: number }>,
  ) {
    if (lines.length === 0) {
      throw new BadRequestException(
        'Journal entry requires at least one line.',
      );
    }

    for (const line of lines) {
      try {
        assertJournalLineValues(line.debit, line.credit);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    }
  }

  private async assertAccountsInTenant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    accountIds: string[],
  ) {
    const ids = [...new Set(accountIds)];
    const count = await tx.account.count({
      where: {
        tenantId,
        id: {
          in: ids,
        },
      },
    });

    if (count !== ids.length) {
      throw new NotFoundException('One or more accounts not found in tenant.');
    }
  }

  private async assertPeriodInTenant(tenantId: string, periodId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!period) {
      throw new NotFoundException('Fiscal period not found.');
    }
  }

  private async assertBranchInTenant(
    tx: Pick<Prisma.TransactionClient, 'branch'>,
    tenantId: string,
    branchId: string,
  ) {
    const row = await tx.branch.findFirst({
      where: {
        id: branchId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!row) {
      throw new NotFoundException('Branch not found in tenant.');
    }
  }

  private validateRuleSetWindow(effectiveFrom: Date, effectiveTo: Date | null) {
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom is invalid.');
    }

    if (effectiveTo !== null && Number.isNaN(effectiveTo.getTime())) {
      throw new BadRequestException('effectiveTo is invalid.');
    }

    if (effectiveTo !== null && effectiveFrom >= effectiveTo) {
      throw new BadRequestException(
        'effectiveTo must be greater than effectiveFrom.',
      );
    }
  }

  private assertRuleSetMutable(status: PostingRuleSetStatus) {
    if (status === PostingRuleSetStatus.ACTIVE) {
      throw new ConflictException(
        'Active posting rule sets are immutable. Create a new version.',
      );
    }
  }

  private async assertNoActiveRuleSetOverlap(
    tenantId: string,
    currentRuleSetId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
  ) {
    const activeRuleSets = await this.prisma.postingRuleSet.findMany({
      where: {
        tenantId,
        status: PostingRuleSetStatus.ACTIVE,
        id: {
          not: currentRuleSetId,
        },
      },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    const overlapping = activeRuleSets.some((ruleSet) =>
      rangesOverlap(
        effectiveFrom,
        effectiveTo,
        ruleSet.effectiveFrom,
        ruleSet.effectiveTo,
      ),
    );

    if (overlapping) {
      throw new ConflictException(
        'Rule set effective window overlaps with another active rule set.',
      );
    }
  }

  private async assertAccountCodesInTenant(
    tenantId: string,
    accountCodes: string[],
  ) {
    const codes = [...new Set(accountCodes.map((code) => code.trim()))];
    const count = await this.prisma.account.count({
      where: {
        tenantId,
        isActive: true,
        code: {
          in: codes,
        },
      },
    });

    if (count !== codes.length) {
      throw new NotFoundException(
        'One or more account codes were not found in tenant.',
      );
    }
  }

  private resolvePeriodWindow(period: { year: number; month: number }) {
    const startAt = new Date(
      Date.UTC(period.year, period.month - 1, 1, 0, 0, 0),
    );
    const endAt = new Date(Date.UTC(period.year, period.month, 1, 0, 0, 0));
    return { startAt, endAt };
  }

  private async buildPeriodSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fiscalPeriodId: string,
    asOfDate: Date,
  ) {
    const groupedLines = await tx.journalLine.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        journalEntry: {
          is: {
            tenantId,
            status: JournalEntryStatus.POSTED,
            fiscalPeriodId,
          },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const accountIds = groupedLines.map((line) => line.accountId);
    const accounts = await tx.account.findMany({
      where: {
        tenantId,
        id: {
          in: accountIds,
        },
      },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        type: true,
      },
      orderBy: [{ code: 'asc' }],
    });
    const accountMap = new Map(
      accounts.map((account) => [account.id, account]),
    );

    const trialBalanceLines = groupedLines
      .map((line) => {
        const account = accountMap.get(line.accountId);
        if (!account) {
          throw new NotFoundException('Account missing for trial balance.');
        }
        const debit = Number(line._sum.debit ?? 0);
        const credit = Number(line._sum.credit ?? 0);
        return {
          accountCode: account.code,
          accountNameAr: account.nameAr,
          accountNameEn: account.nameEn,
          accountType: account.type,
          debit,
          credit,
          balance: debit - credit,
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebit = trialBalanceLines.reduce(
      (sum, line) => sum + line.debit,
      0,
    );
    const totalCredit = trialBalanceLines.reduce(
      (sum, line) => sum + line.credit,
      0,
    );

    const revenueLines = trialBalanceLines.filter(
      (line) => line.accountType === AccountType.REV,
    );
    const expenseLines = trialBalanceLines.filter(
      (line) => line.accountType === AccountType.EXP,
    );
    const assetLines = trialBalanceLines.filter(
      (line) => line.accountType === AccountType.ASSET,
    );
    const liabilityLines = trialBalanceLines.filter(
      (line) => line.accountType === AccountType.LIAB,
    );
    const equityLines = trialBalanceLines.filter(
      (line) => line.accountType === AccountType.EQUITY,
    );

    const totalRevenue = revenueLines.reduce(
      (sum, line) => sum + (line.credit - line.debit),
      0,
    );
    const totalExpenses = expenseLines.reduce(
      (sum, line) => sum + (line.debit - line.credit),
      0,
    );
    const netIncome = totalRevenue - totalExpenses;

    const assetsTotal = assetLines.reduce(
      (sum, line) => sum + (line.debit - line.credit),
      0,
    );
    const liabilitiesTotal = liabilityLines.reduce(
      (sum, line) => sum + (line.credit - line.debit),
      0,
    );
    const equityTotal = equityLines.reduce(
      (sum, line) => sum + (line.credit - line.debit),
      0,
    );
    const retainedEarnings = netIncome;
    const equityTotalWithRetained = equityTotal + retainedEarnings;

    const trialBalancePayload = {
      asOfDate: asOfDate.toISOString(),
      lines: trialBalanceLines,
      totalDebit,
      totalCredit,
      difference: totalDebit - totalCredit,
    };

    const plPayload = {
      asOfDate: asOfDate.toISOString(),
      revenueLines,
      expenseLines,
      totalRevenue,
      totalExpenses,
      netIncome,
    };

    const bsPayload = {
      asOfDate: asOfDate.toISOString(),
      assetLines,
      liabilityLines,
      equityLines: [
        ...equityLines,
        {
          accountCode: 'RETAINED_EARNINGS_CURRENT_PERIOD',
          accountNameAr: 'أرباح محتجزة للفترة الحالية',
          accountNameEn: 'Retained Earnings (Current Period)',
          accountType: AccountType.EQUITY,
          debit: 0,
          credit: retainedEarnings,
          balance: -retainedEarnings,
        },
      ],
      totals: {
        assets: assetsTotal,
        liabilities: liabilitiesTotal,
        equity: equityTotal,
        retainedEarnings,
        equityWithRetained: equityTotalWithRetained,
        balanceCheck:
          assetsTotal - (liabilitiesTotal + equityTotalWithRetained),
      },
    };

    return {
      trialBalancePayload,
      statementPayloadByType: {
        PL: plPayload,
        BS: bsPayload,
      },
    };
  }
}
