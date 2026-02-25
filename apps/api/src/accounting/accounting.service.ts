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
  PostingRuleSetStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingPostingService } from './accounting-posting.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreatePostingRuleDto } from './dto/create-posting-rule.dto';
import { CreatePostingRuleSetDto } from './dto/create-posting-ruleset.dto';
import { QueryJournalsDto } from './dto/query-journals.dto';
import { QueryPostingRulesDto } from './dto/query-posting-rules.dto';
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
}
