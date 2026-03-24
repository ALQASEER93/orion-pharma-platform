import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApBillStatus,
  ApPaymentStatus,
  JournalEntryStatus,
  Prisma,
} from '@prisma/client';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { AccountingService } from '../accounting/accounting.service';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyApPaymentDto } from './dto/apply-ap-payment.dto';
import { CreateApBillDto } from './dto/create-ap-bill.dto';
import { CreateApPaymentDto } from './dto/create-ap-payment.dto';
import { QueryApAgingDto } from './dto/query-ap-aging.dto';
import { QueryApBillsDto } from './dto/query-ap-bills.dto';

const AP_BILL_SEQUENCE_KEY = 'AP_BILL';
const AP_PAYMENT_SEQUENCE_KEY = 'AP_PAYMENT';
const AP_BILL_SOURCE_TYPE = 'AP_BILL';
const AP_PAYMENT_SOURCE_TYPE = 'AP_PAYMENT';
const AP_POST_STAGE = 'POST';
const AP_BILL_VOID_SOURCE_TYPE = 'AP_BILL_VOID';
const AP_BILL_VOID_POST_STAGE = 'VOID';
const EVENT_AP_BILL_CREATED = 'AP_BILL_CREATED';
const EVENT_AP_PAYMENT_POSTED = 'AP_PAYMENT_POSTED';
const EPSILON = 0.000001;

@Injectable()
export class ApService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly accountingPostingService: AccountingPostingService,
  ) {}

  async createBill(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreateApBillDto,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertSupplierInTenant(tx, tenantId, dto.supplierId);

      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key: AP_BILL_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId,
          key: AP_BILL_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });

      const sequenceNumber = sequence.nextNumber - 1;
      const issueDate = new Date(dto.issueDate);
      const billNo = `AP-BILL-${issueDate.getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;
      const originalAmount = this.roundMoney(dto.originalAmount);

      return tx.apBill.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          billNo,
          issueDate,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: ApBillStatus.OPEN,
          originalAmount,
          paidAmount: 0,
          outstandingAmount: originalAmount,
          createdByUserId: user?.sub,
        },
        include: {
          supplier: true,
          allocations: true,
          journalEntry: true,
        },
      });
    });

    if (
      created.journalEntryId === null &&
      created.status === ApBillStatus.OPEN
    ) {
      const payload = {
        apBillId: created.id,
        billNo: created.billNo,
        supplierId: created.supplierId,
        sourceType: created.sourceType ?? '',
        sourceId: created.sourceId ?? '',
        originalAmount: created.originalAmount,
        paidAmount: created.paidAmount,
        outstandingAmount: created.outstandingAmount,
      };

      const simulation = await this.accountingPostingService.simulate({
        tenantId,
        eventType: EVENT_AP_BILL_CREATED,
        payload,
        effectiveAt: created.issueDate,
      });

      if (simulation.journalPreview.lines.length > 0) {
        const postedJournal =
          await this.accountingService.postJournalFromPreview({
            tenantId,
            date: created.issueDate,
            description: `AP bill ${created.billNo}`,
            sourceType: AP_BILL_SOURCE_TYPE,
            sourceId: created.id,
            lines: simulation.journalPreview.lines,
            idempotencyStage: AP_POST_STAGE,
          });
        if (postedJournal?.status === JournalEntryStatus.POSTED) {
          await this.prisma.apBill.update({
            where: { id: created.id },
            data: {
              journalEntryId: postedJournal.id,
            },
          });
        }
      }
    }

    return this.prisma.apBill.findFirstOrThrow({
      where: {
        id: created.id,
        tenantId,
      },
      include: {
        supplier: true,
        allocations: true,
        journalEntry: true,
      },
    });
  }

  async listBills(tenantId: string, query: QueryApBillsDto) {
    return this.prisma.apBill.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.from || query.to
          ? {
              issueDate: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: true,
        allocations: true,
        journalEntry: true,
      },
    });
  }

  async getAging(tenantId: string, query: QueryApAgingDto) {
    const asOf = new Date(`${query.asOf}T23:59:59.999Z`);
    if (Number.isNaN(asOf.getTime())) {
      throw new BadRequestException('Invalid asOf date.');
    }

    const bills = await this.prisma.apBill.findMany({
      where: {
        tenantId,
        issueDate: {
          lte: asOf,
        },
        OR: [
          {
            status: {
              not: ApBillStatus.VOID,
            },
          },
          {
            voidedAt: {
              gt: asOf,
            },
          },
        ],
      },
      include: {
        supplier: {
          select: {
            id: true,
            nameEn: true,
          },
        },
        allocations: {
          where: {
            payment: {
              is: {
                tenantId,
                status: ApPaymentStatus.POSTED,
                date: {
                  lte: asOf,
                },
              },
            },
          },
          select: {
            amount: true,
          },
        },
      },
      orderBy: [{ issueDate: 'asc' }],
    });

    const buckets = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_91_plus: 0,
    };
    let totalOutstanding = 0;
    const billRows: Array<{
      billId: string;
      billNo: string;
      supplierId: string;
      supplierName: string;
      dueDate: string | null;
      outstandingAmount: number;
      bucket: keyof typeof buckets;
    }> = [];

    for (const bill of bills) {
      const outstanding = this.resolveApOutstandingAsOf(bill);
      if (outstanding <= 0) {
        continue;
      }
      const dueBase = bill.dueDate ?? bill.issueDate;
      const diffDays = Math.floor(
        (asOf.getTime() - dueBase.getTime()) / (1000 * 60 * 60 * 24),
      );
      const bucket = this.resolveAgingBucket(diffDays);
      buckets[bucket] = this.roundMoney(buckets[bucket] + outstanding);
      totalOutstanding = this.roundMoney(totalOutstanding + outstanding);

      billRows.push({
        billId: bill.id,
        billNo: bill.billNo,
        supplierId: bill.supplierId,
        supplierName: bill.supplier.nameEn,
        dueDate: bill.dueDate?.toISOString() ?? null,
        outstandingAmount: outstanding,
        bucket,
      });
    }

    return {
      asOf: query.asOf,
      totals: {
        ...buckets,
        totalOutstanding,
      },
      bills: billRows,
    };
  }

  async createPayment(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreateApPaymentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertSupplierInTenant(tx, tenantId, dto.supplierId);

      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key: AP_PAYMENT_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId,
          key: AP_PAYMENT_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });
      const sequenceNumber = sequence.nextNumber - 1;
      const paymentNo = `AP-PMT-${new Date(dto.date).getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;

      return tx.apPayment.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          paymentNo,
          date: new Date(dto.date),
          amount: this.roundMoney(dto.amount),
          method: dto.method,
          reference: dto.reference,
          status: ApPaymentStatus.DRAFT,
          createdByUserId: user?.sub,
        },
        include: {
          supplier: true,
          allocations: true,
          journalEntry: true,
        },
      });
    });
  }

  async applyPayment(
    tenantId: string,
    paymentId: string,
    dto: ApplyApPaymentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.apPayment.findFirst({
        where: {
          id: paymentId,
          tenantId,
        },
        include: {
          allocations: true,
        },
      });
      if (!payment) {
        throw new NotFoundException('AP payment not found.');
      }
      if (payment.status !== ApPaymentStatus.DRAFT) {
        throw new ConflictException('Only draft payments can be allocated.');
      }

      const totalToAllocate = this.roundMoney(
        dto.allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      );
      if (totalToAllocate - payment.amount > EPSILON) {
        throw new ConflictException('Allocation total exceeds payment amount.');
      }

      for (const current of payment.allocations) {
        await tx.apBill.updateMany({
          where: {
            id: current.billId,
            tenantId,
            status: {
              not: ApBillStatus.VOID,
            },
          },
          data: {
            paidAmount: {
              decrement: current.amount,
            },
            outstandingAmount: {
              increment: current.amount,
            },
            status: ApBillStatus.OPEN,
          },
        });
      }

      await tx.apAllocation.deleteMany({
        where: {
          tenantId,
          paymentId: payment.id,
        },
      });

      for (const allocation of dto.allocations) {
        const bill = await tx.apBill.findFirst({
          where: {
            id: allocation.billId,
            tenantId,
          },
        });
        if (!bill) {
          throw new NotFoundException('AP bill not found.');
        }
        if (bill.supplierId !== payment.supplierId) {
          throw new NotFoundException('AP bill not found.');
        }
        if (bill.status === ApBillStatus.VOID) {
          throw new ConflictException('Cannot allocate against void AP bill.');
        }
        if (allocation.amount - bill.outstandingAmount > EPSILON) {
          throw new ConflictException(
            `Allocation exceeds outstanding amount for bill ${bill.billNo}.`,
          );
        }

        const newOutstanding = this.roundMoney(
          bill.outstandingAmount - allocation.amount,
        );
        const newPaid = this.roundMoney(bill.paidAmount + allocation.amount);

        await tx.apAllocation.create({
          data: {
            tenantId,
            paymentId: payment.id,
            billId: bill.id,
            amount: this.roundMoney(allocation.amount),
          },
        });

        await tx.apBill.update({
          where: { id: bill.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status:
              newOutstanding <= EPSILON ? ApBillStatus.PAID : ApBillStatus.OPEN,
          },
        });
      }

      return tx.apPayment.findFirstOrThrow({
        where: {
          id: payment.id,
          tenantId,
        },
        include: {
          supplier: true,
          allocations: {
            include: {
              bill: true,
            },
          },
          journalEntry: true,
        },
      });
    });
  }

  async postPayment(tenantId: string, paymentId: string) {
    const payment = await this.prisma.apPayment.findFirst({
      where: {
        id: paymentId,
        tenantId,
      },
      include: {
        allocations: {
          include: {
            bill: true,
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('AP payment not found.');
    }
    if (
      payment.status === ApPaymentStatus.POSTED &&
      payment.journalEntryId !== null
    ) {
      throw new ConflictException('AP payment already posted.');
    }
    if (payment.status !== ApPaymentStatus.DRAFT) {
      throw new ConflictException('Only draft payments can be posted.');
    }

    const allocatedAmount = this.roundMoney(
      payment.allocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0,
      ),
    );
    if (allocatedAmount <= EPSILON) {
      throw new ConflictException('Payment must be allocated before posting.');
    }
    if (allocatedAmount - payment.amount > EPSILON) {
      throw new ConflictException('Allocated amount exceeds payment amount.');
    }

    const payload = {
      paymentId: payment.id,
      paymentNo: payment.paymentNo,
      supplierId: payment.supplierId,
      paymentAmount: payment.amount,
      allocatedAmount,
      method: payment.method,
      reference: payment.reference ?? '',
    };
    const simulation = await this.accountingPostingService.simulate({
      tenantId,
      eventType: EVENT_AP_PAYMENT_POSTED,
      payload,
      effectiveAt: payment.date,
    });

    const postedJournal = await this.accountingService.postJournalFromPreview({
      tenantId,
      date: payment.date,
      description: `AP payment ${payment.paymentNo}`,
      sourceType: AP_PAYMENT_SOURCE_TYPE,
      sourceId: payment.id,
      lines: simulation.journalPreview.lines,
      idempotencyStage: AP_POST_STAGE,
    });
    if (!postedJournal || postedJournal.status !== JournalEntryStatus.POSTED) {
      throw new ConflictException(
        'Posting rules did not produce a postable journal for payment.',
      );
    }

    const update = await this.prisma.apPayment.updateMany({
      where: {
        id: payment.id,
        tenantId,
        status: ApPaymentStatus.DRAFT,
      },
      data: {
        status: ApPaymentStatus.POSTED,
        journalEntryId: postedJournal.id,
      },
    });
    if (update.count === 0) {
      throw new ConflictException('AP payment already posted.');
    }

    return this.prisma.apPayment.findFirstOrThrow({
      where: {
        id: payment.id,
        tenantId,
      },
      include: {
        supplier: true,
        allocations: {
          include: {
            bill: true,
          },
        },
        journalEntry: true,
      },
    });
  }

  async voidBill(tenantId: string, billId: string) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.apBill.findFirst({
        where: {
          id: billId,
          tenantId,
        },
        include: {
          allocations: true,
          supplier: true,
          journalEntry: {
            include: {
              lines: {
                include: {
                  account: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!bill) {
        throw new NotFoundException('AP bill not found.');
      }
      if (bill.status === ApBillStatus.VOID) {
        return bill;
      }
      if (bill.paidAmount > EPSILON || bill.allocations.length > 0) {
        throw new ConflictException(
          'AP bill with allocations or payments cannot be voided.',
        );
      }

      if (!bill.journalEntry) {
        throw new ConflictException(
          'AP bill cannot be voided without a posted journal entry.',
        );
      }

      const voidedAt = new Date();
      await this.accountingService.postJournalFromPreviewWithTx(tx, {
        tenantId,
        date: voidedAt,
        description: `Void AP bill ${bill.billNo}`,
        sourceType: AP_BILL_VOID_SOURCE_TYPE,
        sourceId: bill.id,
        idempotencyStage: AP_BILL_VOID_POST_STAGE,
        defaultBranchId: bill.journalEntry.branchId ?? undefined,
        lines: bill.journalEntry.lines.map((line) => ({
          accountCode: line.account.code,
          debit: Number(line.credit),
          credit: Number(line.debit),
          memo: line.memo ?? `Void AP bill ${bill.billNo}`,
          branchId: line.branchId ?? bill.journalEntry?.branchId ?? undefined,
        })),
      });

      return tx.apBill.update({
        where: {
          id: bill.id,
        },
        data: {
          status: ApBillStatus.VOID,
          outstandingAmount: 0,
          voidedAt,
        },
        include: {
          allocations: true,
          supplier: true,
          journalEntry: true,
        },
      });
    });
  }

  private resolveAgingBucket(diffDays: number) {
    if (diffDays <= 0) {
      return 'current' as const;
    }
    if (diffDays <= 30) {
      return 'days_1_30' as const;
    }
    if (diffDays <= 60) {
      return 'days_31_60' as const;
    }
    if (diffDays <= 90) {
      return 'days_61_90' as const;
    }
    return 'days_91_plus' as const;
  }

  private resolveApOutstandingAsOf(bill: {
    originalAmount: number;
    allocations: Array<{ amount: number }>;
  }) {
    const allocated = bill.allocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0,
    );

    return Math.max(
      0,
      this.roundMoney(Number(bill.originalAmount) - allocated),
    );
  }

  private async assertSupplierInTenant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    supplierId: string,
  ) {
    const row = await tx.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId,
      },
      select: {
        id: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Supplier not found in tenant.');
    }
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
