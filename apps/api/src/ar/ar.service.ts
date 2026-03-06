import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArInvoiceStatus,
  ArReceiptStatus,
  JournalEntryStatus,
  Prisma,
  SalesInvoiceStatus,
} from '@prisma/client';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { AccountingService } from '../accounting/accounting.service';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyArReceiptDto } from './dto/apply-ar-receipt.dto';
import { CreateArReceiptDto } from './dto/create-ar-receipt.dto';
import { QueryArAgingDto } from './dto/query-ar-aging.dto';
import { QueryArInvoicesDto } from './dto/query-ar-invoices.dto';

const AR_RECEIPT_SEQUENCE_KEY = 'AR_RECEIPT';
const AR_RECEIPT_SOURCE_TYPE = 'AR_RECEIPT';
const AR_RECEIPT_POST_STAGE = 'POST';
const AR_INVOICE_SOURCE_TYPE = 'AR_INVOICE';
const AR_INVOICE_POST_STAGE = 'POST';
const AR_INVOICE_VOID_SOURCE_TYPE = 'AR_INVOICE_VOID';
const AR_INVOICE_VOID_POST_STAGE = 'VOID';
const EVENT_AR_INVOICE_CREATED = 'AR_INVOICE_CREATED';
const EVENT_AR_RECEIPT_POSTED = 'AR_RECEIPT_POSTED';
const EPSILON = 0.000001;

@Injectable()
export class ArService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly accountingPostingService: AccountingPostingService,
  ) {}

  async createInvoiceFromSales(
    tenantId: string,
    user: JwtUserPayload | undefined,
    salesInvoiceId: string,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.arInvoice.findFirst({
        where: {
          tenantId,
          salesInvoiceId,
        },
        include: {
          customer: true,
          salesInvoice: true,
          allocations: true,
          journalEntry: true,
        },
      });
      if (existing) {
        return existing;
      }

      const salesInvoice = await tx.salesInvoice.findFirst({
        where: {
          id: salesInvoiceId,
          tenantId,
        },
        include: {
          payments: {
            select: {
              amount: true,
            },
          },
        },
      });
      if (!salesInvoice) {
        throw new NotFoundException('Sales invoice not found.');
      }
      if (salesInvoice.status !== SalesInvoiceStatus.POSTED) {
        throw new ConflictException(
          'AR invoice can only be created from posted sales invoice.',
        );
      }
      if (!salesInvoice.customerId) {
        throw new ConflictException(
          'Sales invoice requires customer to create AR invoice.',
        );
      }

      const paidAmount = this.roundMoney(
        salesInvoice.payments.reduce((sum, payment) => sum + payment.amount, 0),
      );
      const originalAmount = this.roundMoney(salesInvoice.grandTotal);
      const outstandingAmount = this.roundMoney(
        Math.max(originalAmount - paidAmount, 0),
      );
      const status =
        outstandingAmount <= EPSILON
          ? ArInvoiceStatus.PAID
          : ArInvoiceStatus.OPEN;

      return tx.arInvoice.create({
        data: {
          tenantId,
          customerId: salesInvoice.customerId,
          salesInvoiceId: salesInvoice.id,
          status,
          invoiceNo: salesInvoice.invoiceNo,
          issueDate: salesInvoice.issuedAt,
          originalAmount,
          paidAmount,
          outstandingAmount,
          createdByUserId: user?.sub,
        },
        include: {
          customer: true,
          salesInvoice: true,
          allocations: true,
          journalEntry: true,
        },
      });
    });

    if (
      created.status === ArInvoiceStatus.OPEN &&
      created.journalEntryId === null
    ) {
      const payload = {
        arInvoiceId: created.id,
        salesInvoiceId: created.salesInvoiceId,
        invoiceNo: created.invoiceNo,
        customerId: created.customerId,
        originalAmount: created.originalAmount,
        paidAmount: created.paidAmount,
        outstandingAmount: created.outstandingAmount,
        taxTotal: created.salesInvoice.taxTotal,
        discountTotal: created.salesInvoice.discountTotal,
        grandTotal: created.salesInvoice.grandTotal,
      };
      const simulation = await this.accountingPostingService.simulate({
        tenantId,
        eventType: EVENT_AR_INVOICE_CREATED,
        payload,
        effectiveAt: created.issueDate,
        branchId: created.salesInvoice.branchId ?? undefined,
      });

      if (simulation.journalPreview.lines.length > 0) {
        const postedJournal =
          await this.accountingService.postJournalFromPreview({
            tenantId,
            date: created.issueDate,
            description: `AR invoice ${created.invoiceNo}`,
            sourceType: AR_INVOICE_SOURCE_TYPE,
            sourceId: created.id,
            lines: simulation.journalPreview.lines,
            defaultBranchId: created.salesInvoice.branchId ?? undefined,
            idempotencyStage: AR_INVOICE_POST_STAGE,
          });
        if (postedJournal?.status === JournalEntryStatus.POSTED) {
          await this.prisma.arInvoice.update({
            where: { id: created.id },
            data: {
              journalEntryId: postedJournal.id,
            },
          });
        }
      }
    }

    return this.prisma.arInvoice.findFirstOrThrow({
      where: {
        id: created.id,
        tenantId,
      },
      include: {
        customer: true,
        salesInvoice: true,
        allocations: true,
        journalEntry: true,
      },
    });
  }

  async listInvoices(tenantId: string, query: QueryArInvoicesDto) {
    return this.prisma.arInvoice.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
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
        customer: true,
        salesInvoice: true,
        allocations: true,
        journalEntry: true,
      },
    });
  }

  async getAging(tenantId: string, query: QueryArAgingDto) {
    const asOf = new Date(`${query.asOf}T23:59:59.999Z`);
    if (Number.isNaN(asOf.getTime())) {
      throw new BadRequestException('Invalid asOf date.');
    }

    const invoices = await this.prisma.arInvoice.findMany({
      where: {
        tenantId,
        issueDate: {
          lte: asOf,
        },
        OR: [
          {
            status: {
              not: ArInvoiceStatus.VOID,
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
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        allocations: {
          where: {
            receipt: {
              is: {
                tenantId,
                status: ArReceiptStatus.POSTED,
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
    const invoiceRows: Array<{
      invoiceId: string;
      invoiceNo: string;
      customerId: string;
      customerName: string;
      dueDate: string | null;
      outstandingAmount: number;
      bucket: keyof typeof buckets;
    }> = [];

    for (const invoice of invoices) {
      const outstanding = this.resolveArOutstandingAsOf(invoice);
      if (outstanding <= 0) {
        continue;
      }
      const dueBase = invoice.dueDate ?? invoice.issueDate;
      const diffDays = Math.floor(
        (asOf.getTime() - dueBase.getTime()) / (1000 * 60 * 60 * 24),
      );
      const bucket = this.resolveAgingBucket(diffDays);
      buckets[bucket] = this.roundMoney(buckets[bucket] + outstanding);
      totalOutstanding = this.roundMoney(totalOutstanding + outstanding);

      invoiceRows.push({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        customerId: invoice.customerId,
        customerName: invoice.customer.name,
        dueDate: invoice.dueDate?.toISOString() ?? null,
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
      invoices: invoiceRows,
    };
  }

  async createReceipt(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreateArReceiptDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCustomerInTenant(tx, tenantId, dto.customerId);

      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key: AR_RECEIPT_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId,
          key: AR_RECEIPT_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });
      const sequenceNumber = sequence.nextNumber - 1;
      const receiptNo = `AR-RCPT-${new Date(dto.date).getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;

      return tx.arReceipt.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          receiptNo,
          date: new Date(dto.date),
          amount: this.roundMoney(dto.amount),
          method: dto.method,
          reference: dto.reference,
          status: ArReceiptStatus.DRAFT,
          createdByUserId: user?.sub,
        },
        include: {
          customer: true,
          allocations: true,
        },
      });
    });
  }

  async applyReceipt(
    tenantId: string,
    receiptId: string,
    dto: ApplyArReceiptDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.arReceipt.findFirst({
        where: {
          id: receiptId,
          tenantId,
        },
        include: {
          allocations: true,
        },
      });
      if (!receipt) {
        throw new NotFoundException('AR receipt not found.');
      }
      if (receipt.status !== ArReceiptStatus.DRAFT) {
        throw new ConflictException('Only draft receipts can be allocated.');
      }

      const totalToAllocate = this.roundMoney(
        dto.allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      );
      if (totalToAllocate - receipt.amount > EPSILON) {
        throw new ConflictException('Allocation total exceeds receipt amount.');
      }

      for (const current of receipt.allocations) {
        await tx.arInvoice.updateMany({
          where: {
            id: current.invoiceId,
            tenantId,
            status: {
              not: ArInvoiceStatus.VOID,
            },
          },
          data: {
            paidAmount: {
              decrement: current.amount,
            },
            outstandingAmount: {
              increment: current.amount,
            },
            status: ArInvoiceStatus.OPEN,
          },
        });
      }

      await tx.arAllocation.deleteMany({
        where: {
          tenantId,
          receiptId: receipt.id,
        },
      });

      for (const allocation of dto.allocations) {
        const invoice = await tx.arInvoice.findFirst({
          where: {
            id: allocation.invoiceId,
            tenantId,
          },
        });
        if (!invoice) {
          throw new NotFoundException('AR invoice not found.');
        }
        if (invoice.customerId !== receipt.customerId) {
          throw new NotFoundException('AR invoice not found.');
        }
        if (invoice.status === ArInvoiceStatus.VOID) {
          throw new ConflictException(
            'Cannot allocate against void AR invoice.',
          );
        }

        if (allocation.amount - invoice.outstandingAmount > EPSILON) {
          throw new ConflictException(
            `Allocation exceeds outstanding amount for invoice ${invoice.invoiceNo}.`,
          );
        }

        const newOutstanding = this.roundMoney(
          invoice.outstandingAmount - allocation.amount,
        );
        const newPaid = this.roundMoney(invoice.paidAmount + allocation.amount);

        await tx.arAllocation.create({
          data: {
            tenantId,
            receiptId: receipt.id,
            invoiceId: invoice.id,
            amount: this.roundMoney(allocation.amount),
          },
        });

        await tx.arInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status:
              newOutstanding <= EPSILON
                ? ArInvoiceStatus.PAID
                : ArInvoiceStatus.OPEN,
          },
        });
      }

      return tx.arReceipt.findFirstOrThrow({
        where: {
          id: receipt.id,
          tenantId,
        },
        include: {
          customer: true,
          allocations: {
            include: {
              invoice: true,
            },
          },
        },
      });
    });
  }

  async postReceipt(tenantId: string, receiptId: string) {
    const receipt = await this.prisma.arReceipt.findFirst({
      where: {
        id: receiptId,
        tenantId,
      },
      include: {
        allocations: {
          include: {
            invoice: {
              include: {
                salesInvoice: {
                  select: {
                    branchId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!receipt) {
      throw new NotFoundException('AR receipt not found.');
    }

    if (
      receipt.status === ArReceiptStatus.POSTED &&
      receipt.journalEntryId !== null
    ) {
      return receipt;
    }
    if (receipt.status !== ArReceiptStatus.DRAFT) {
      throw new ConflictException('Only draft receipts can be posted.');
    }

    const allocatedAmount = this.roundMoney(
      receipt.allocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0,
      ),
    );
    if (allocatedAmount <= EPSILON) {
      throw new ConflictException('Receipt must be allocated before posting.');
    }
    if (allocatedAmount - receipt.amount > EPSILON) {
      throw new ConflictException('Allocated amount exceeds receipt amount.');
    }

    const branchId =
      receipt.allocations
        .map((allocation) => allocation.invoice.salesInvoice.branchId)
        .find((value) => value !== null) ?? undefined;

    const payload = {
      receiptId: receipt.id,
      receiptNo: receipt.receiptNo,
      customerId: receipt.customerId,
      receiptAmount: receipt.amount,
      allocatedAmount,
      method: receipt.method,
      reference: receipt.reference ?? '',
    };
    const simulation = await this.accountingPostingService.simulate({
      tenantId,
      eventType: EVENT_AR_RECEIPT_POSTED,
      payload,
      effectiveAt: receipt.date,
      branchId,
    });

    const postedJournal = await this.accountingService.postJournalFromPreview({
      tenantId,
      date: receipt.date,
      description: `AR receipt ${receipt.receiptNo}`,
      sourceType: AR_RECEIPT_SOURCE_TYPE,
      sourceId: receipt.id,
      lines: simulation.journalPreview.lines,
      defaultBranchId: branchId,
      idempotencyStage: AR_RECEIPT_POST_STAGE,
    });
    if (!postedJournal || postedJournal.status !== JournalEntryStatus.POSTED) {
      throw new ConflictException(
        'Posting rules did not produce a postable journal for receipt.',
      );
    }

    await this.prisma.arReceipt.updateMany({
      where: {
        id: receipt.id,
        tenantId,
        status: ArReceiptStatus.DRAFT,
      },
      data: {
        status: ArReceiptStatus.POSTED,
        journalEntryId: postedJournal.id,
      },
    });

    return this.prisma.arReceipt.findFirstOrThrow({
      where: {
        id: receipt.id,
        tenantId,
      },
      include: {
        customer: true,
        allocations: {
          include: {
            invoice: true,
          },
        },
        journalEntry: true,
      },
    });
  }

  async voidInvoice(tenantId: string, arInvoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.arInvoice.findFirst({
        where: {
          id: arInvoiceId,
          tenantId,
        },
        include: {
          allocations: true,
          customer: true,
          salesInvoice: true,
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
      if (!invoice) {
        throw new NotFoundException('AR invoice not found.');
      }
      if (invoice.status === ArInvoiceStatus.VOID) {
        return invoice;
      }
      if (invoice.paidAmount > EPSILON || invoice.allocations.length > 0) {
        throw new ConflictException(
          'AR invoice with allocations or payments cannot be voided.',
        );
      }

      if (!invoice.journalEntry) {
        throw new ConflictException(
          'AR invoice cannot be voided without a posted journal entry.',
        );
      }

      const voidedAt = new Date();
      await this.accountingService.postJournalFromPreviewWithTx(tx, {
        tenantId,
        date: voidedAt,
        description: `Void AR invoice ${invoice.invoiceNo}`,
        sourceType: AR_INVOICE_VOID_SOURCE_TYPE,
        sourceId: invoice.id,
        idempotencyStage: AR_INVOICE_VOID_POST_STAGE,
        defaultBranchId: invoice.journalEntry.branchId ?? undefined,
        lines: invoice.journalEntry.lines.map((line) => ({
          accountCode: line.account.code,
          debit: Number(line.credit),
          credit: Number(line.debit),
          memo: line.memo ?? `Void AR invoice ${invoice.invoiceNo}`,
          branchId:
            line.branchId ?? invoice.journalEntry?.branchId ?? undefined,
        })),
      });

      return tx.arInvoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status: ArInvoiceStatus.VOID,
          outstandingAmount: 0,
          voidedAt,
        },
        include: {
          allocations: true,
          customer: true,
          salesInvoice: true,
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

  private resolveArOutstandingAsOf(invoice: {
    originalAmount: number;
    allocations: Array<{ amount: number }>;
  }) {
    const allocated = invoice.allocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0,
    );

    return Math.max(
      0,
      this.roundMoney(Number(invoice.originalAmount) - allocated),
    );
  }

  private async assertCustomerInTenant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
  ) {
    const row = await tx.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
      },
      select: {
        id: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Customer not found in tenant.');
    }
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
