import { ConflictException } from '@nestjs/common';
import { FiscalPeriodStatus, JournalEntryStatus } from '@prisma/client';
import { AccountingService } from './accounting.service';

describe('AccountingService', () => {
  const prisma = {
    $transaction: jest.fn(),
  };

  let service: AccountingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountingService(prisma as never);
  });

  it('rejects posting for unbalanced entry', async () => {
    const tx = {
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'je-1',
          tenantId: 'tenant-1',
          status: JournalEntryStatus.DRAFT,
          date: new Date('2026-02-10T00:00:00Z'),
          lines: [
            { debit: 100, credit: 0 },
            { debit: 0, credit: 80 },
          ],
        }),
      },
      fiscalPeriod: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'period-1',
          status: FiscalPeriodStatus.OPEN,
        }),
      },
      postingKey: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementationOnce(
      (cb: (trx: unknown) => Promise<unknown>) => cb(tx),
    );

    await expect(
      service.postJournal('tenant-1', 'je-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects posting for closed period', async () => {
    const tx = {
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'je-1',
          tenantId: 'tenant-1',
          status: JournalEntryStatus.DRAFT,
          date: new Date('2026-02-10T00:00:00Z'),
          lines: [
            { debit: 100, credit: 0 },
            { debit: 0, credit: 100 },
          ],
        }),
      },
      fiscalPeriod: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'period-1',
          status: FiscalPeriodStatus.CLOSED,
        }),
      },
      postingKey: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementationOnce(
      (cb: (trx: unknown) => Promise<unknown>) => cb(tx),
    );

    await expect(
      service.postJournal('tenant-1', 'je-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
