import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  JournalEntryStatus,
  Prisma,
  SalesInvoiceStatus,
  TrackingMode,
} from '@prisma/client';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { AccountingService } from '../accounting/accounting.service';
import { InventoryValuationService } from '../inventory/inventory-valuation.service';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { CreateSalesInvoiceLineDto } from './dto/create-sales-invoice-line.dto';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
import { QuerySalesInvoicesDto } from './dto/query-sales-invoices.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { UpdateSalesInvoiceLineDto } from './dto/update-sales-invoice-line.dto';
import { allocateStockFefo, type StockLotCandidate } from './stock-allocation';

const SALES_INVOICE_SEQUENCE_KEY = 'SALES_INVOICE';
const COST_METHOD_SNAPSHOT = 'MOVING_AVG';
const STOCK_ERROR_CODE = 'STOCK_INSUFFICIENT';
const EVENT_SALES_COGS_POSTED = 'SALES_COGS_POSTED';
const SALES_INVOICE_SOURCE_TYPE = 'SALES_INVOICE';
const COGS_POST_STAGE = 'COGS_POST';

type StockInsufficientDetail = {
  lineId: string;
  productId: string;
  requiredQty: number;
  availableQty: number;
};

type LinePostingPlan = {
  lineId: string;
  productId: string;
  requiredQty: number;
  unitCostSnapshot: number;
  allocations: Array<{
    quantity: number;
    batchNo: string | null;
    expiryDate: Date | null;
  }>;
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly inventoryValuationService: InventoryValuationService,
  ) {}

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
        cogsPostingLink: true,
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

      const branchId = await this.resolveBranchForDraft(
        tx,
        tenantId,
        user,
        dto.branchId,
      );

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
          branchId,
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

  async postInvoice(
    tenantId: string,
    user: JwtUserPayload | undefined,
    invoiceId: string,
  ) {
    try {
      const postedInvoiceId = await this.prisma.$transaction(async (tx) => {
        const invoice = await this.getInvoiceWithRelations(
          tx,
          tenantId,
          invoiceId,
        );

        if (invoice.status === SalesInvoiceStatus.POSTED) {
          return invoice.id;
        }

        if (invoice.status !== SalesInvoiceStatus.DRAFT) {
          throw new ConflictException('Invoice is not in draft status.');
        }

        if (!invoice.branchId) {
          throw new ConflictException(
            'Invoice branch is required before posting.',
          );
        }

        const totals = await this.recalculateInvoiceTotals(
          tx,
          tenantId,
          invoice.id,
        );
        if (totals.lineCount === 0) {
          throw new ConflictException('Cannot post invoice without lines.');
        }

        const postingPlans = await this.buildPostingPlans(
          tx,
          tenantId,
          invoice.branchId,
          invoice.lines,
        );
        await this.applyPostingPlans(
          tx,
          tenantId,
          invoice.branchId,
          invoice.invoiceNo,
          user?.sub ?? invoice.createdByUserId ?? undefined,
          postingPlans,
        );

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

        return posted.id;
      });

      return this.toInvoiceResponse(
        await this.ensureCogsPosted(tenantId, postedInvoiceId),
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.ensureCogsPosted(tenantId, invoiceId);

      if (existing?.status === SalesInvoiceStatus.POSTED) {
        return this.toInvoiceResponse(existing);
      }

      throw new ConflictException('Invoice posting is already in progress.');
    }
  }

  async checkout(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: PosCheckoutDto,
  ) {
    if (!user) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    const postedInvoiceId = await this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        await this.assertCustomerInTenant(tx, tenantId, dto.customerId);
      }

      const branchId = await this.resolveBranchForDraft(
        tx,
        tenantId,
        user,
        dto.branchId,
      );

      const draft = await this.createDraftWithTransaction(tx, tenantId, user, {
        branchId,
        customerId: dto.customerId,
        currency: dto.currency ?? 'JOD',
      });

      for (const line of dto.lines) {
        const resolved = await this.resolveLine(tx, tenantId, line);
        if (!resolved.productId) {
          throw new BadRequestException(
            'POS checkout requires productId for all lines.',
          );
        }

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

      const refreshed = await this.getInvoiceWithRelations(
        tx,
        tenantId,
        draft.id,
      );
      if (!refreshed.branchId) {
        throw new ConflictException(
          'Invoice branch is required before posting.',
        );
      }

      const postingPlans = await this.buildPostingPlans(
        tx,
        tenantId,
        refreshed.branchId,
        refreshed.lines,
      );
      await this.applyPostingPlans(
        tx,
        tenantId,
        refreshed.branchId,
        refreshed.invoiceNo,
        user.sub,
        postingPlans,
      );

      const posted = await tx.salesInvoice.update({
        where: { id: draft.id },
        data: { status: SalesInvoiceStatus.POSTED },
        include: {
          customer: true,
          lines: true,
          payments: true,
        },
      });

      return posted.id;
    });

    return this.toInvoiceResponse(
      await this.ensureCogsPosted(tenantId, postedInvoiceId),
    );
  }

  async postCogs(tenantId: string, invoiceId: string) {
    return this.toInvoiceResponse(
      await this.ensureCogsPosted(tenantId, invoiceId),
    );
  }

  private async createDraftWithTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    user: JwtUserPayload,
    dto: {
      branchId: string;
      customerId?: string;
      currency?: string;
      issuedAt?: string;
    },
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
        branchId: dto.branchId,
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

  private async resolveBranchForDraft(
    tx: Prisma.TransactionClient,
    tenantId: string,
    user: JwtUserPayload,
    dtoBranchId?: string,
  ): Promise<string> {
    if (dtoBranchId) {
      await this.assertBranchInTenant(tx, tenantId, dtoBranchId);
      return dtoBranchId;
    }

    const actor = await tx.user.findFirst({
      where: {
        id: user.sub,
        tenantId,
      },
      select: {
        branchId: true,
      },
    });

    if (!actor?.branchId) {
      throw new BadRequestException(
        'Branch ID is required for sales posting context.',
      );
    }

    await this.assertBranchInTenant(tx, tenantId, actor.branchId);
    return actor.branchId;
  }

  private async assertBranchInTenant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string,
  ) {
    const branch = await tx.branch.findFirst({
      where: {
        id: branchId,
        tenantId,
      },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found in tenant.');
    }
  }

  private assertStockLineQuantity(lineId: string, qty: number): number {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException(
        `Stock line ${lineId} requires a positive integer quantity.`,
      );
    }

    return qty;
  }

  private async buildPostingPlans(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string,
    lines: Array<{
      id: string;
      productId: string | null;
      qty: number;
    }>,
  ): Promise<LinePostingPlan[]> {
    const productIds = lines
      .map((line) => line.productId)
      .filter(Boolean) as string[];
    if (productIds.length !== lines.length) {
      throw new ConflictException(
        'Posted invoices require productId on all lines.',
      );
    }

    const products = await tx.product.findMany({
      where: {
        tenantId,
        id: {
          in: [...new Set(productIds)],
        },
      },
      select: {
        id: true,
        trackingMode: true,
      },
    });
    const productMap = new Map(products.map((item) => [item.id, item]));

    const insufficient: StockInsufficientDetail[] = [];
    const plans: LinePostingPlan[] = [];
    const allowNegativeStock = this.isNegativeStockAllowed();

    for (const line of lines) {
      const productId = line.productId;
      if (!productId) {
        throw new ConflictException(
          'Posted invoices require productId on all lines.',
        );
      }

      const product = productMap.get(productId);
      if (!product) {
        throw new NotFoundException('Product not found in tenant.');
      }

      const requiredQty = this.assertStockLineQuantity(line.id, line.qty);

      const { allocations, availableQty } = await this.planLineAllocations(
        tx,
        tenantId,
        branchId,
        productId,
        product.trackingMode,
        requiredQty,
      );

      if (!allowNegativeStock && availableQty < requiredQty) {
        insufficient.push({
          lineId: line.id,
          productId,
          requiredQty,
          availableQty,
        });
        continue;
      }

      const unitCostSnapshot =
        await this.inventoryValuationService.getCurrentAvgUnitCost(
          tx,
          tenantId,
          branchId,
          productId,
        );

      plans.push({
        lineId: line.id,
        productId,
        requiredQty,
        unitCostSnapshot,
        allocations,
      });
    }

    if (insufficient.length > 0) {
      this.throwStockInsufficient(insufficient);
    }

    return plans;
  }

  private async planLineAllocations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string,
    productId: string,
    trackingMode: TrackingMode,
    requiredQty: number,
  ): Promise<{
    allocations: Array<{
      quantity: number;
      batchNo: string | null;
      expiryDate: Date | null;
    }>;
    availableQty: number;
  }> {
    const balances = await tx.inventoryBalance.findMany({
      where: {
        tenantId,
        branchId,
        productId,
        quantity: {
          gt: 0,
        },
      },
      select: {
        batchNo: true,
        quantity: true,
      },
    });

    const allowNegativeStock = this.isNegativeStockAllowed();
    if (balances.length === 0) {
      return {
        allocations: allowNegativeStock
          ? [{ quantity: requiredQty, batchNo: null, expiryDate: null }]
          : [],
        availableQty: 0,
      };
    }

    const expiryMap = new Map<string, Date | null>();
    if (trackingMode !== TrackingMode.NONE) {
      const movementRows = await tx.inventoryMovement.findMany({
        where: {
          tenantId,
          branchId,
          productId,
          batchNo: {
            not: null,
          },
          expiryDate: {
            not: null,
          },
        },
        select: {
          batchNo: true,
          expiryDate: true,
        },
        orderBy: [{ expiryDate: 'asc' }],
      });

      for (const row of movementRows) {
        if (!row.batchNo) {
          continue;
        }

        if (!expiryMap.has(row.batchNo)) {
          expiryMap.set(row.batchNo, row.expiryDate ?? null);
        }
      }
    }

    const candidates: StockLotCandidate[] = balances.map((item) => ({
      batchNo: item.batchNo || null,
      expiryDate: expiryMap.get(item.batchNo) ?? null,
      quantity: item.quantity,
    }));

    const planned = allocateStockFefo(candidates, requiredQty);

    if (planned.allocations.length > 0) {
      return planned;
    }

    return {
      allocations: allowNegativeStock
        ? [{ quantity: requiredQty, batchNo: null, expiryDate: null }]
        : [],
      availableQty: planned.availableQty,
    };
  }

  private async applyPostingPlans(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string,
    invoiceNo: string,
    createdByUserId: string | undefined,
    plans: LinePostingPlan[],
  ) {
    const allowNegativeStock = this.isNegativeStockAllowed();

    for (const plan of plans) {
      for (const allocation of plan.allocations) {
        const batchNoKey = allocation.batchNo ?? '';

        await tx.inventoryBalance.upsert({
          where: {
            tenantId_branchId_productId_batchNo: {
              tenantId,
              branchId,
              productId: plan.productId,
              batchNo: batchNoKey,
            },
          },
          update: {},
          create: {
            tenantId,
            branchId,
            productId: plan.productId,
            batchNo: batchNoKey,
            quantity: 0,
          },
        });

        if (!allowNegativeStock) {
          const guarded = await tx.inventoryBalance.updateMany({
            where: {
              tenantId,
              branchId,
              productId: plan.productId,
              batchNo: batchNoKey,
              quantity: {
                gte: allocation.quantity,
              },
            },
            data: {
              quantity: {
                decrement: allocation.quantity,
              },
            },
          });

          if (guarded.count === 0) {
            this.throwStockInsufficient([
              {
                lineId: plan.lineId,
                productId: plan.productId,
                requiredQty: plan.requiredQty,
                availableQty: 0,
              },
            ]);
          }
        } else {
          await tx.inventoryBalance.update({
            where: {
              tenantId_branchId_productId_batchNo: {
                tenantId,
                branchId,
                productId: plan.productId,
                batchNo: batchNoKey,
              },
            },
            data: {
              quantity: {
                decrement: allocation.quantity,
              },
            },
          });
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            tenantId,
            branchId,
            productId: plan.productId,
            salesInvoiceLineId: plan.lineId,
            batchNo: allocation.batchNo,
            expiryDate: allocation.expiryDate,
            movementType: InventoryMovementType.OUT,
            quantity: -allocation.quantity,
            unitCost: plan.unitCostSnapshot,
            costTotal: this.roundMoney(
              allocation.quantity * plan.unitCostSnapshot,
            ),
            reason: `Sales invoice ${invoiceNo}`,
            createdBy: createdByUserId,
          },
        });

        await this.inventoryValuationService.applyMovement(tx, {
          tenantId,
          inventoryMovementId: movement.id,
          branchId,
          productId: plan.productId,
          quantityDelta: -allocation.quantity,
          unitCost: plan.unitCostSnapshot,
          salesInvoiceLineId: plan.lineId,
          writeSnapshot: true,
        });
      }

      await tx.salesInvoiceLine.update({
        where: { id: plan.lineId },
        data: {
          unitCostSnapshot: plan.unitCostSnapshot,
          costMethodSnapshot: COST_METHOD_SNAPSHOT,
        },
      });
    }
  }

  private async ensureCogsPosted(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
      },
      include: {
        customer: true,
        lines: true,
        payments: true,
        cogsPostingLink: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Sales invoice not found.');
    }
    if (invoice.status !== SalesInvoiceStatus.POSTED) {
      throw new ConflictException(
        'COGS can only be posted for posted invoices.',
      );
    }
    if (!invoice.branchId) {
      throw new ConflictException(
        'Invoice branch is required for COGS posting.',
      );
    }
    if (invoice.cogsPostingLink) {
      return invoice;
    }

    const linesForPosting = await this.prisma.$transaction(async (tx) => {
      const draftLines: Array<{
        lineId: string;
        productId: string;
        qty: number;
        unitCostSnapshot: number;
        lineCogs: number;
      }> = [];

      for (const line of invoice.lines) {
        if (!line.productId) {
          continue;
        }
        const qty = this.assertStockLineQuantity(line.id, line.qty);
        const snapshot =
          line.unitCostSnapshot ??
          (await this.inventoryValuationService.getCurrentAvgUnitCost(
            tx,
            tenantId,
            invoice.branchId as string,
            line.productId,
          ));

        if (line.unitCostSnapshot === null) {
          await tx.salesInvoiceLine.update({
            where: { id: line.id },
            data: {
              unitCostSnapshot: snapshot,
              costMethodSnapshot: COST_METHOD_SNAPSHOT,
            },
          });
        }

        draftLines.push({
          lineId: line.id,
          productId: line.productId,
          qty,
          unitCostSnapshot: this.roundMoney(snapshot),
          lineCogs: this.roundMoney(qty * snapshot),
        });
      }

      return draftLines;
    });

    const totalCogs = this.roundMoney(
      linesForPosting.reduce((sum, line) => sum + line.lineCogs, 0),
    );

    const payload = {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      branchId: invoice.branchId,
      totalCogs,
      currency: invoice.currency,
      lines: linesForPosting.map((line) => ({
        productId: line.productId,
        qty: line.qty,
        unitCostSnapshot: line.unitCostSnapshot,
        lineCogs: line.lineCogs,
      })),
    };

    const simulation = await this.accountingPostingService.simulate({
      tenantId,
      eventType: EVENT_SALES_COGS_POSTED,
      payload,
      effectiveAt: invoice.issuedAt,
      branchId: invoice.branchId,
    });

    if (simulation.journalPreview.lines.length === 0) {
      throw new ConflictException(
        'Posting rules did not produce a postable journal for COGS.',
      );
    }

    const postedJournal = await this.accountingService.postJournalFromPreview({
      tenantId,
      date: invoice.issuedAt,
      description: `COGS for ${invoice.invoiceNo}`,
      sourceType: SALES_INVOICE_SOURCE_TYPE,
      sourceId: invoice.id,
      lines: simulation.journalPreview.lines,
      defaultBranchId: invoice.branchId,
      idempotencyStage: COGS_POST_STAGE,
    });
    if (!postedJournal || postedJournal.status !== JournalEntryStatus.POSTED) {
      throw new ConflictException('Failed to post COGS journal.');
    }

    try {
      await this.prisma.cogsPostingLink.create({
        data: {
          tenantId,
          salesInvoiceId: invoice.id,
          journalEntryId: postedJournal.id,
        },
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
    }

    return this.prisma.salesInvoice.findFirstOrThrow({
      where: {
        id: invoice.id,
        tenantId,
      },
      include: {
        customer: true,
        lines: true,
        payments: true,
        cogsPostingLink: true,
      },
    });
  }

  private isNegativeStockAllowed(): boolean {
    return (
      (process.env.ORION_ALLOW_NEGATIVE_STOCK ?? 'false').toLowerCase() ===
      'true'
    );
  }

  private throwStockInsufficient(details: StockInsufficientDetail[]): never {
    throw new ConflictException({
      code: STOCK_ERROR_CODE,
      message: 'Insufficient stock to post sales invoice.',
      details,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
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
