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
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { QueryJournalsDto } from './dto/query-journals.dto';
import {
  assertJournalLineValues,
  isBalanced,
} from './utils/journal-validation';

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
  constructor(private readonly prisma: PrismaService) {}

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
    tx: Prisma.TransactionClient,
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
}
