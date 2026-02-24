import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalesInvoiceStatus } from '@prisma/client';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { CreateSalesInvoiceLineDto } from './dto/create-sales-invoice-line.dto';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
import { QuerySalesInvoicesDto } from './dto/query-sales-invoices.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { UpdateSalesInvoiceLineDto } from './dto/update-sales-invoice-line.dto';

const SALES_INVOICE_SEQUENCE_KEY = 'SALES_INVOICE';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async listInvoices(tenantId: string, query: QuerySalesInvoicesDto) {
    const where: Prisma.SalesInvoiceWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.q
        ? {
            OR: [
              { invoiceNo: { contains: query.q } },
              { customer: { name: { contains: query.q } } },
            ],
          }
        : {}),
    };

    const records = await this.prisma.salesInvoice.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: true,
        lines: true,
        payments: true,
      },
    });

    return records.map((record) => this.toInvoiceResponse(record));
  }

  async createDraft(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreateSalesInvoiceDto,
  ) {
    if (!user) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        await this.assertCustomerInTenant(tx, tenantId, dto.customerId);
      }

      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key: SALES_INVOICE_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId,
          key: SALES_INVOICE_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });

      const sequenceNumber = sequence.nextNumber - 1;
      const invoiceNo = `SI-${new Date().getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;

      const created = await tx.salesInvoice.create({
        data: {
          tenantId,
          invoiceNo,
          status: SalesInvoiceStatus.DRAFT,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
          customerId: dto.customerId,
          currency: dto.currency ?? 'JOD',
          createdByUserId: user.sub,
        },
        include: {
          customer: true,
          lines: true,
          payments: true,
        },
      });

      return this.toInvoiceResponse(created);
    });
  }

  async detailInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
      },
      include: {
        customer: true,
        lines: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Sales invoice not found.');
    }

    return this.toInvoiceResponse(invoice);
  }

  async updateHeader(
    tenantId: string,
    invoiceId: string,
    dto: UpdateSalesInvoiceDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.loadDraftInvoice(tx, tenantId, invoiceId);
      if (dto.customerId) {
        await this.assertCustomerInTenant(tx, tenantId, dto.customerId);
      }

      const updated = await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          customerId: dto.customerId === undefined ? undefined : dto.customerId,
          currency: dto.currency,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        },
        include: {
          customer: true,
          lines: true,
          payments: true,
        },
      });

      return this.toInvoiceResponse(updated);
    });
  }

  async addLine(
    tenantId: string,
    invoiceId: string,
    dto: CreateSalesInvoiceLineDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.loadDraftInvoice(tx, tenantId, invoiceId);
      const resolved = await this.resolveLine(tx, tenantId, dto);

      const lineTotal = this.computeLineTotal(
        dto.qty,
        dto.unitPrice,
        dto.discount ?? 0,
        dto.taxRate,
      );

      await tx.salesInvoiceLine.create({
        data: {
          invoiceId: invoice.id,
          tenantId,
          productId: resolved.productId,
          itemName: resolved.itemName,
          qty: dto.qty,
          unitPrice: dto.unitPrice,
          discount: dto.discount ?? 0,
          taxRate: dto.taxRate,
          lineTotal,
        },
      });

      await this.recalculateInvoiceTotals(tx, tenantId, invoice.id);
      const refreshed = await this.getInvoiceWithRelations(
        tx,
        tenantId,
        invoice.id,
      );
      return this.toInvoiceResponse(refreshed);
    });
  }

  async updateLine(
    tenantId: string,
    invoiceId: string,
    lineId: string,
    dto: UpdateSalesInvoiceLineDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.loadDraftInvoice(tx, tenantId, invoiceId);
      const line = await tx.salesInvoiceLine.findFirst({
        where: {
          id: lineId,
          invoiceId: invoice.id,
          tenantId,
        },
      });

      if (!line) {
        throw new NotFoundException('Sales invoice line not found.');
      }

      const nextProductId =
        dto.productId !== undefined ? dto.productId : line.productId;
      let nextItemName = dto.itemName ?? line.itemName;

      if (nextProductId) {
        const product = await tx.product.findFirst({
          where: {
            id: nextProductId,
            tenantId,
          },
          select: {
            id: true,
            nameEn: true,
          },
        });

        if (!product) {
          throw new NotFoundException('Product not found in tenant.');
        }
        nextItemName = dto.itemName ?? product.nameEn;
      }

      if (!nextItemName || !nextItemName.trim()) {
        throw new BadRequestException(
          'itemName is required when product is absent.',
        );
      }

      const nextQty = dto.qty ?? line.qty;
      const nextUnitPrice = dto.unitPrice ?? line.unitPrice;
      const nextDiscount = dto.discount ?? line.discount;
      const nextTaxRate =
        dto.taxRate === undefined ? line.taxRate : dto.taxRate;

      const lineTotal = this.computeLineTotal(
        nextQty,
        nextUnitPrice,
        nextDiscount,
        nextTaxRate ?? undefined,
      );

      await tx.salesInvoiceLine.update({
        where: { id: line.id },
        data: {
          productId: nextProductId,
          itemName: nextItemName,
          qty: nextQty,
          unitPrice: nextUnitPrice,
          discount: nextDiscount,
          taxRate: nextTaxRate,
          lineTotal,
        },
      });

      await this.recalculateInvoiceTotals(tx, tenantId, invoice.id);
      const refreshed = await this.getInvoiceWithRelations(
        tx,
        tenantId,
        invoice.id,
      );
      return this.toInvoiceResponse(refreshed);
    });
  }

  async deleteLine(tenantId: string, invoiceId: string, lineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.loadDraftInvoice(tx, tenantId, invoiceId);
      const line = await tx.salesInvoiceLine.findFirst({
        where: {
          id: lineId,
          invoiceId: invoice.id,
          tenantId,
        },
        select: { id: true },
      });

      if (!line) {
        throw new NotFoundException('Sales invoice line not found.');
      }

      await tx.salesInvoiceLine.delete({ where: { id: line.id } });
      await this.recalculateInvoiceTotals(tx, tenantId, invoice.id);
      const refreshed = await this.getInvoiceWithRelations(
        tx,
        tenantId,
        invoice.id,
      );
      return this.toInvoiceResponse(refreshed);
    });
  }

  async postInvoice(tenantId: string, invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.loadDraftInvoice(tx, tenantId, invoiceId);
      const totals = await this.recalculateInvoiceTotals(
        tx,
        tenantId,
        invoice.id,
      );
      if (totals.lineCount === 0) {
        throw new ConflictException('Cannot post invoice without lines.');
      }

      const posted = await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          status: SalesInvoiceStatus.POSTED,
        },
        include: {
          customer: true,
          lines: true,
          payments: true,
        },
      });

      return this.toInvoiceResponse(posted);
    });
  }

  async checkout(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: PosCheckoutDto,
  ) {
    if (!user) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        await this.assertCustomerInTenant(tx, tenantId, dto.customerId);
      }

      const draft = await this.createDraftWithTransaction(tx, tenantId, user, {
        customerId: dto.customerId,
        currency: dto.currency ?? 'JOD',
      });

      for (const line of dto.lines) {
        const resolved = await this.resolveLine(tx, tenantId, line);
        const lineTotal = this.computeLineTotal(
          line.qty,
          line.unitPrice,
          line.discount ?? 0,
          line.taxRate,
        );

        await tx.salesInvoiceLine.create({
          data: {
            invoiceId: draft.id,
            tenantId,
            productId: resolved.productId,
            itemName: resolved.itemName,
            qty: line.qty,
            unitPrice: line.unitPrice,
            discount: line.discount ?? 0,
            taxRate: line.taxRate,
            lineTotal,
          },
        });
      }

      const totals = await this.recalculateInvoiceTotals(
        tx,
        tenantId,
        draft.id,
      );
      if (totals.grandTotal <= 0) {
        throw new ConflictException(
          'Checkout requires a positive grand total.',
        );
      }

      if (dto.payment.amount < totals.grandTotal) {
        throw new ConflictException('Payment amount is below grand total.');
      }

      await tx.salesPayment.create({
        data: {
          invoiceId: draft.id,
          tenantId,
          method: dto.payment.method,
          amount: dto.payment.amount,
          createdByUserId: user.sub,
        },
      });

      const posted = await tx.salesInvoice.update({
        where: { id: draft.id },
        data: { status: SalesInvoiceStatus.POSTED },
        include: {
          customer: true,
          lines: true,
          payments: true,
        },
      });

      return this.toInvoiceResponse(posted);
    });
  }

  private async createDraftWithTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    user: JwtUserPayload,
    dto: { customerId?: string; currency?: string; issuedAt?: string },
  ) {
    const sequence = await tx.documentSequence.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: SALES_INVOICE_SEQUENCE_KEY,
        },
      },
      create: {
        tenantId,
        key: SALES_INVOICE_SEQUENCE_KEY,
        nextNumber: 2,
      },
      update: {
        nextNumber: {
          increment: 1,
        },
      },
    });

    const sequenceNumber = sequence.nextNumber - 1;
    const invoiceNo = `SI-${new Date().getUTCFullYear()}-${sequenceNumber
      .toString()
      .padStart(6, '0')}`;

    return tx.salesInvoice.create({
      data: {
        tenantId,
        invoiceNo,
        status: SalesInvoiceStatus.DRAFT,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        customerId: dto.customerId,
        currency: dto.currency ?? 'JOD',
        createdByUserId: user.sub,
      },
    });
  }

  private async loadDraftInvoice(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoiceId: string,
  ) {
    const invoice = await tx.salesInvoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Sales invoice not found.');
    }

    if (invoice.status !== SalesInvoiceStatus.DRAFT) {
      throw new ConflictException('Only draft invoices can be modified.');
    }

    return invoice;
  }

  private async assertCustomerInTenant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
  ) {
    const customer = await tx.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
      },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found in tenant.');
    }
  }

  private async resolveLine(
    tx: Prisma.TransactionClient,
    tenantId: string,
    line: {
      productId?: string | null;
      itemName?: string;
      qty: number;
      unitPrice: number;
      discount?: number;
      taxRate?: number;
    },
  ) {
    if (line.productId) {
      const product = await tx.product.findFirst({
        where: {
          id: line.productId,
          tenantId,
        },
        select: {
          id: true,
          nameEn: true,
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found in tenant.');
      }

      return {
        productId: product.id,
        itemName: line.itemName?.trim() || product.nameEn,
      };
    }

    if (!line.itemName || !line.itemName.trim()) {
      throw new BadRequestException(
        'itemName is required when productId is not provided.',
      );
    }

    return {
      productId: null,
      itemName: line.itemName.trim(),
    };
  }

  private async recalculateInvoiceTotals(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoiceId: string,
  ) {
    const lines = await tx.salesInvoiceLine.findMany({
      where: {
        tenantId,
        invoiceId,
      },
      select: {
        qty: true,
        unitPrice: true,
        discount: true,
        taxRate: true,
      },
    });

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    for (const line of lines) {
      const lineBase = line.qty * line.unitPrice;
      const lineDiscount = Math.max(line.discount, 0);
      const taxable = Math.max(lineBase - lineDiscount, 0);
      const lineTax = line.taxRate ? taxable * (line.taxRate / 100) : 0;

      subtotal += lineBase;
      discountTotal += lineDiscount;
      taxTotal += lineTax;
    }

    const grandTotal = subtotal - discountTotal + taxTotal;

    await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        subtotal: this.roundMoney(subtotal),
        discountTotal: this.roundMoney(discountTotal),
        taxTotal: this.roundMoney(taxTotal),
        grandTotal: this.roundMoney(grandTotal),
      },
    });

    return {
      lineCount: lines.length,
      subtotal: this.roundMoney(subtotal),
      discountTotal: this.roundMoney(discountTotal),
      taxTotal: this.roundMoney(taxTotal),
      grandTotal: this.roundMoney(grandTotal),
    };
  }

  private computeLineTotal(
    qty: number,
    unitPrice: number,
    discount: number,
    taxRate?: number,
  ): number {
    const base = qty * unitPrice;
    const safeDiscount = Math.max(discount, 0);
    const taxable = Math.max(base - safeDiscount, 0);
    const tax = taxRate ? taxable * (taxRate / 100) : 0;
    return this.roundMoney(taxable + tax);
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async getInvoiceWithRelations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoiceId: string,
  ) {
    const invoice = await tx.salesInvoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
      },
      include: {
        customer: true,
        lines: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Sales invoice not found.');
    }

    return invoice;
  }

  private toInvoiceResponse<
    T extends { lines: Array<{ qty: number; lineTotal: number }> },
  >(invoice: T) {
    return {
      ...invoice,
      totalLines: invoice.lines.length,
      totalQuantity: invoice.lines.reduce((sum, line) => sum + line.qty, 0),
      computedGrandTotal: this.roundMoney(
        invoice.lines.reduce((sum, line) => sum + line.lineTotal, 0),
      ),
    };
  }
}
