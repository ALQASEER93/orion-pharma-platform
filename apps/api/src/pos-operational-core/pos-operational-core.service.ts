import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalesPaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddPosCartLineInput } from './dto/add-pos-cart-line.input';
import { AddPosReturnLineInput } from './dto/add-pos-return-line.input';
import { CreatePosCartSessionInput } from './dto/create-pos-cart-session.input';
import { CreatePosReturnSessionInput } from './dto/create-pos-return-session.input';
import { FinalizePosCartPaymentInput } from './dto/finalize-pos-cart-payment.input';
import { FinalizePosReturnInput } from './dto/finalize-pos-return.input';

type BucketFieldName =
  | 'sellableQuantity'
  | 'quarantinedQuantity'
  | 'expiredQuantity';

type OperationalContext = {
  legalEntityId: string | null;
};

type Totals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
};

const POS_CART_SEQUENCE_KEY = 'POS_CART_SESSION';
const POS_RETURN_SEQUENCE_KEY = 'POS_RETURN_SESSION';
const POS_FISCAL_SALE_SEQUENCE_KEY = 'POS_FISCAL_SALE_DOCUMENT';
const POS_FISCAL_RETURN_SEQUENCE_KEY = 'POS_FISCAL_RETURN_DOCUMENT';
const RETURN_ELIGIBLE_SALE_STATES = ['FINALIZED', 'ACCEPTED'] as const;

@Injectable()
export class PosOperationalCoreService {
  constructor(private readonly prisma: PrismaService) {}

  async createCartSession(input: CreatePosCartSessionInput) {
    const context = await this.resolveOperationalContext({
      tenantId: input.tenantId,
      branchId: input.branchId,
      registerId: input.registerId,
      legalEntityId: input.legalEntityId ?? null,
    });

    return this.prisma.$transaction(async (tx) => {
      const next = await this.nextSequence(tx, input.tenantId, POS_CART_SEQUENCE_KEY);
      const sessionNumber = this.buildDocumentNo('PCS', next);
      return tx.posCartSession.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: input.branchId,
          registerId: input.registerId,
          sessionNumber,
          currency: input.currency ?? 'JOD',
          notes: input.notes ?? null,
          createdBy: input.createdBy ?? null,
        },
      });
    });
  }

  async addCartLine(input: AddPosCartLineInput) {
    this.assertPositiveInt(input.quantity, 'quantity');
    this.assertNonNegative(input.unitPrice, 'unitPrice');
    this.assertNonNegative(input.discount ?? 0, 'discount');
    this.assertNonNegative(input.taxRate ?? 0, 'taxRate');

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.posCartSession.findFirst({
        where: { id: input.cartSessionId, tenantId: input.tenantId },
        select: { id: true, state: true },
      });
      if (!session) {
        throw new NotFoundException('POS cart session not found in tenant.');
      }
      if (session.state !== 'OPEN' && session.state !== 'PAYMENT_PENDING') {
        throw new ConflictException(
          'POS cart session must be OPEN or PAYMENT_PENDING to add lines.',
        );
      }

      await this.assertPackLotForSale({
        tx,
        tenantId: input.tenantId,
        productPackId: input.productPackId,
        lotBatchId: input.lotBatchId,
      });

      const lineNo = await this.resolveLineNo(tx, {
        model: 'cart',
        sessionId: input.cartSessionId,
        requestedLineNo: input.lineNo,
      });

      const lineTotal =
        input.lineTotal ??
        this.computeLineTotal(
          input.quantity,
          input.unitPrice,
          input.discount ?? 0,
          input.taxRate ?? 0,
        );

      const created = await tx.posCartLine.create({
        data: {
          cartSessionId: input.cartSessionId,
          tenantId: input.tenantId,
          lineNo,
          productPackId: input.productPackId,
          lotBatchId: input.lotBatchId,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          discount: input.discount ?? 0,
          taxRate: input.taxRate ?? null,
          lineTotal,
          notes: input.notes ?? null,
        },
      });

      await this.refreshCartTotals(tx, input.tenantId, input.cartSessionId);
      return created;
    });
  }

  async finalizeCartPayment(input: FinalizePosCartPaymentInput) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.posCartSession.findFirst({
        where: { id: input.cartSessionId, tenantId: input.tenantId },
        include: { lines: true },
      });
      if (!session) {
        throw new NotFoundException('POS cart session not found in tenant.');
      }
      if (session.state === 'FINALIZED') {
        throw new ConflictException('POS cart session is already finalized.');
      }
      if (session.state === 'CANCELLED') {
        throw new ConflictException('Cancelled POS cart session cannot be finalized.');
      }
      if (session.lines.length === 0) {
        throw new ConflictException('POS cart session requires at least one line.');
      }

      const context = await this.resolveOperationalContext({
        tx,
        tenantId: input.tenantId,
        branchId: session.branchId,
        registerId: session.registerId,
        legalEntityId: session.legalEntityId ?? null,
      });

      const totals = this.computeTotals(
        session.lines.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          taxRate: line.taxRate ?? 0,
        })),
      );

      const amountApplied = this.roundMoney(input.amountApplied ?? totals.grandTotal);
      if (amountApplied !== totals.grandTotal) {
        throw new ConflictException(
          'amountApplied must equal cart grandTotal for sale finalization.',
        );
      }
      const amountTendered = this.roundMoney(input.amountTendered ?? amountApplied);
      if (amountTendered < amountApplied) {
        throw new ConflictException('amountTendered cannot be less than amountApplied.');
      }

      const fiscalNo = this.buildDocumentNo(
        'FSD-POS',
        await this.nextSequence(tx, input.tenantId, POS_FISCAL_SALE_SEQUENCE_KEY),
      );

      const fiscalSale = await tx.fiscalSaleDocument.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: session.branchId,
          registerId: session.registerId,
          documentNo: fiscalNo,
          state: 'FINALIZED',
          finalizedAt: new Date(),
          currency: session.currency,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          inventoryAnchorReferenceId: session.id,
          createdByUserId: input.createdBy ?? session.createdBy ?? null,
          lines: {
            create: session.lines.map((line) => ({
              tenantId: input.tenantId,
              lineNo: line.lineNo,
              productPackId: line.productPackId,
              lotBatchId: line.lotBatchId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
              referenceKey: `POS_CART_LINE:${line.id}`,
            })),
          },
        },
        include: { lines: true },
      });

      const fiscalLineByNo = new Map(
        fiscalSale.lines.map((line) => [line.lineNo, line]),
      );
      for (const line of session.lines) {
        const fiscalLine = fiscalLineByNo.get(line.lineNo);
        if (!fiscalLine) {
          throw new ConflictException('Missing fiscal line mapping for cart line.');
        }

        const ledgerEntry = await this.applyInventoryLedgerMovement(tx, {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: session.branchId,
          registerId: session.registerId,
          productPackId: line.productPackId,
          lotBatchId: line.lotBatchId,
          quantityDelta: -line.quantity,
          entryType: 'STOCK_OUT',
          referenceType: 'SALE',
          referenceId: fiscalSale.id,
          referenceLineId: fiscalLine.id,
          reasonCode: 'POS_SALE_FINALIZATION',
          unitCost: null,
          amountTotal: line.lineTotal,
          createdBy: input.createdBy ?? session.createdBy ?? null,
        });

        await tx.posCartLine.update({
          where: { id: line.id },
          data: {
            fiscalSaleLineId: fiscalLine.id,
            inventoryLedgerEntryId: ledgerEntry.id,
          },
        });
      }

      await tx.posPaymentFinalization.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: session.branchId,
          registerId: session.registerId,
          cartSessionId: session.id,
          fiscalSaleDocumentId: fiscalSale.id,
          flowType: 'SALE_FINALIZATION',
          state: 'FINALIZED',
          paymentMethod: input.paymentMethod,
          amountApplied,
          amountTendered,
          changeAmount: this.roundMoney(amountTendered - amountApplied),
          referenceCode: input.paymentReference ?? null,
          notes: input.notes ?? null,
          finalizedAt: new Date(),
          createdBy: input.createdBy ?? session.createdBy ?? null,
        },
      });

      await tx.posCartSession.update({
        where: { id: session.id },
        data: {
          state: 'FINALIZED',
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          finalizedAt: new Date(),
          fiscalSaleDocumentId: fiscalSale.id,
        },
      });

      return tx.posCartSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { lines: true, paymentFinalizations: true },
      });
    });
  }

  async createReturnSession(input: CreatePosReturnSessionInput) {
    const context = await this.resolveOperationalContext({
      tenantId: input.tenantId,
      branchId: input.branchId,
      registerId: input.registerId,
      legalEntityId: input.legalEntityId ?? null,
    });

    if (input.sourceSaleDocumentId) {
      await this.assertReturnSourceSaleDocument({
        db: this.prisma,
        tenantId: input.tenantId,
        sourceSaleDocumentId: input.sourceSaleDocumentId,
        branchId: input.branchId,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const next = await this.nextSequence(tx, input.tenantId, POS_RETURN_SEQUENCE_KEY);
      const returnNumber = this.buildDocumentNo('PRS', next);
      return tx.posReturnSession.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: input.branchId,
          registerId: input.registerId,
          sourceSaleDocumentId: input.sourceSaleDocumentId ?? null,
          returnNumber,
          reasonCode: input.reasonCode ?? null,
          currency: input.currency ?? 'JOD',
          notes: input.notes ?? null,
          createdBy: input.createdBy ?? null,
        },
      });
    });
  }

  async addReturnLine(input: AddPosReturnLineInput) {
    this.assertPositiveInt(input.quantityReturned, 'quantityReturned');
    this.assertNonNegative(input.unitPrice, 'unitPrice');
    this.assertNonNegative(input.discount ?? 0, 'discount');
    this.assertNonNegative(input.taxRate ?? 0, 'taxRate');

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.posReturnSession.findFirst({
        where: { id: input.returnSessionId, tenantId: input.tenantId },
        select: {
          id: true,
          state: true,
          branchId: true,
          sourceSaleDocumentId: true,
        },
      });
      if (!session) {
        throw new NotFoundException('POS return session not found in tenant.');
      }
      if (session.state !== 'OPEN') {
        throw new ConflictException('Only OPEN POS return sessions can accept lines.');
      }

      await this.assertPackLotLink({
        tx,
        tenantId: input.tenantId,
        productPackId: input.productPackId,
        lotBatchId: input.lotBatchId,
      });

      if (session.sourceSaleDocumentId && !input.sourceSaleLineId) {
        throw new ConflictException(
          'sourceSaleLineId is required when return session is linked to a source sale document.',
        );
      }

      if (input.sourceSaleLineId) {
        const sourceLine = await tx.fiscalSaleDocumentLine.findFirst({
          where: { id: input.sourceSaleLineId, tenantId: input.tenantId },
          select: {
            id: true,
            saleDocumentId: true,
            quantity: true,
            productPackId: true,
            lotBatchId: true,
            saleDocument: {
              select: { id: true, branchId: true, state: true },
            },
          },
        });
        if (!sourceLine) {
          throw new NotFoundException('Source fiscal sale line not found in tenant.');
        }
        if (!sourceLine.saleDocument) {
          throw new NotFoundException(
            'Source fiscal sale document not found for sourceSaleLineId.',
          );
        }
        if (
          session.sourceSaleDocumentId &&
          sourceLine.saleDocumentId !== session.sourceSaleDocumentId
        ) {
          throw new ConflictException(
            'sourceSaleLineId must belong to the return session source sale document.',
          );
        }
        if (sourceLine.saleDocument.branchId !== session.branchId) {
          throw new ConflictException(
            'sourceSaleLineId must belong to the same branch as the return session.',
          );
        }
        if (
          !(RETURN_ELIGIBLE_SALE_STATES as readonly string[]).includes(
            sourceLine.saleDocument.state,
          )
        ) {
          throw new ConflictException(
            'Returns require source fiscal sale document state FINALIZED or ACCEPTED.',
          );
        }
        if (sourceLine.productPackId !== input.productPackId) {
          throw new ConflictException(
            'sourceSaleLineId product pack does not match return line product pack.',
          );
        }
        if ((sourceLine.lotBatchId ?? null) !== input.lotBatchId) {
          throw new ConflictException(
            'sourceSaleLineId lot batch does not match return line lot batch.',
          );
        }

        const finalizedReturned = await tx.fiscalReturnDocumentLine.aggregate({
          where: {
            tenantId: input.tenantId,
            sourceSaleLineId: sourceLine.id,
            returnDocument: {
              state: { in: ['FINALIZED', 'QUEUED', 'ACCEPTED'] },
            },
          },
          _sum: { quantity: true },
        });
        const pendingInSession = await tx.posReturnLine.aggregate({
          where: {
            tenantId: input.tenantId,
            returnSessionId: input.returnSessionId,
            sourceSaleLineId: sourceLine.id,
          },
          _sum: { quantityReturned: true },
        });

        const alreadyReturned = finalizedReturned._sum.quantity ?? 0;
        const pendingReturn = pendingInSession._sum.quantityReturned ?? 0;
        const remaining = sourceLine.quantity - alreadyReturned - pendingReturn;
        if (remaining <= 0) {
          throw new ConflictException('Source sale line is already fully returned.');
        }
        if (input.quantityReturned > remaining) {
          throw new ConflictException(
            `quantityReturned exceeds remaining source sale quantity (${remaining}).`,
          );
        }
      }

      const lineNo = await this.resolveLineNo(tx, {
        model: 'return',
        sessionId: input.returnSessionId,
        requestedLineNo: input.lineNo,
      });

      const lineTotal =
        input.lineTotal ??
        this.computeLineTotal(
          input.quantityReturned,
          input.unitPrice,
          input.discount ?? 0,
          input.taxRate ?? 0,
        );

      const created = await tx.posReturnLine.create({
        data: {
          returnSessionId: input.returnSessionId,
          tenantId: input.tenantId,
          sourceSaleLineId: input.sourceSaleLineId ?? null,
          lineNo,
          productPackId: input.productPackId,
          lotBatchId: input.lotBatchId,
          quantityReturned: input.quantityReturned,
          unitPrice: input.unitPrice,
          discount: input.discount ?? 0,
          taxRate: input.taxRate ?? null,
          lineTotal,
          reasonCode: input.reasonCode ?? null,
          notes: input.notes ?? null,
        },
      });

      await this.refreshReturnTotals(tx, input.tenantId, input.returnSessionId);
      return created;
    });
  }

  async finalizeReturn(input: FinalizePosReturnInput) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.posReturnSession.findFirst({
        where: { id: input.returnSessionId, tenantId: input.tenantId },
        include: { lines: true },
      });
      if (!session) {
        throw new NotFoundException('POS return session not found in tenant.');
      }
      if (session.state === 'FINALIZED') {
        throw new ConflictException('POS return session is already finalized.');
      }
      if (session.state === 'CANCELLED') {
        throw new ConflictException('Cancelled POS return session cannot be finalized.');
      }
      if (session.lines.length === 0) {
        throw new ConflictException('POS return session requires at least one line.');
      }

      const context = await this.resolveOperationalContext({
        tx,
        tenantId: input.tenantId,
        branchId: session.branchId,
        registerId: session.registerId,
        legalEntityId: session.legalEntityId ?? null,
      });

      if (session.sourceSaleDocumentId) {
        await this.assertReturnSourceSaleDocument({
          db: tx,
          tenantId: input.tenantId,
          sourceSaleDocumentId: session.sourceSaleDocumentId,
          branchId: session.branchId,
        });
        if (session.lines.some((line) => !line.sourceSaleLineId)) {
          throw new ConflictException(
            'All return lines must carry sourceSaleLineId when source sale is linked.',
          );
        }
      }

      await this.assertReturnSessionLineCaps(tx, {
        tenantId: input.tenantId,
        returnSessionId: session.id,
        returnLines: session.lines.map((line) => ({
          sourceSaleLineId: line.sourceSaleLineId,
          quantityReturned: line.quantityReturned,
        })),
      });

      const totals = this.computeTotals(
        session.lines.map((line) => ({
          quantity: line.quantityReturned,
          unitPrice: line.unitPrice,
          discount: line.discount,
          taxRate: line.taxRate ?? 0,
        })),
      );

      const refundAmount = this.roundMoney(input.refundAmount ?? totals.grandTotal);
      if (refundAmount !== totals.grandTotal) {
        throw new ConflictException(
          'refundAmount must equal return grandTotal for bounded return finalization.',
        );
      }

      const fiscalNo = this.buildDocumentNo(
        'FRD-POS',
        await this.nextSequence(tx, input.tenantId, POS_FISCAL_RETURN_SEQUENCE_KEY),
      );

      const fiscalReturn = await tx.fiscalReturnDocument.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: session.branchId,
          registerId: session.registerId,
          sourceSaleDocumentId: session.sourceSaleDocumentId,
          documentNo: fiscalNo,
          state: 'FINALIZED',
          finalizedAt: new Date(),
          currency: session.currency,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          inventoryAnchorReferenceId: session.id,
          createdByUserId: input.createdBy ?? session.createdBy ?? null,
          lines: {
            create: session.lines.map((line) => ({
              tenantId: input.tenantId,
              sourceSaleLineId: line.sourceSaleLineId,
              lineNo: line.lineNo,
              productPackId: line.productPackId,
              lotBatchId: line.lotBatchId,
              quantity: line.quantityReturned,
              unitPrice: line.unitPrice,
              discount: line.discount,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
              reasonCode: line.reasonCode,
            })),
          },
        },
        include: { lines: true },
      });

      const fiscalLineByNo = new Map(
        fiscalReturn.lines.map((line) => [line.lineNo, line]),
      );
      for (const line of session.lines) {
        const fiscalLine = fiscalLineByNo.get(line.lineNo);
        if (!fiscalLine) {
          throw new ConflictException('Missing fiscal return line mapping.');
        }

        const ledgerEntry = await this.applyInventoryLedgerMovement(tx, {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: session.branchId,
          registerId: session.registerId,
          productPackId: line.productPackId,
          lotBatchId: line.lotBatchId,
          quantityDelta: line.quantityReturned,
          entryType: 'STOCK_IN',
          referenceType: 'RETURN',
          referenceId: fiscalReturn.id,
          referenceLineId: fiscalLine.id,
          reasonCode: 'POS_RETURN_FINALIZATION',
          unitCost: null,
          amountTotal: line.lineTotal,
          createdBy: input.createdBy ?? session.createdBy ?? null,
        });

        await tx.posReturnLine.update({
          where: { id: line.id },
          data: {
            fiscalReturnLineId: fiscalLine.id,
            inventoryLedgerEntryId: ledgerEntry.id,
          },
        });
      }

      await tx.posPaymentFinalization.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: session.branchId,
          registerId: session.registerId,
          returnSessionId: session.id,
          fiscalReturnDocumentId: fiscalReturn.id,
          flowType: 'RETURN_REFUND',
          state: 'FINALIZED',
          paymentMethod: input.refundMethod,
          amountApplied: refundAmount,
          amountTendered: refundAmount,
          changeAmount: 0,
          referenceCode: input.refundReference ?? null,
          notes: input.notes ?? null,
          finalizedAt: new Date(),
          createdBy: input.createdBy ?? session.createdBy ?? null,
        },
      });

      await tx.posReturnSession.update({
        where: { id: session.id },
        data: {
          state: 'FINALIZED',
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          finalizedAt: new Date(),
          fiscalReturnDocumentId: fiscalReturn.id,
        },
      });

      return tx.posReturnSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { lines: true, paymentFinalizations: true },
      });
    });
  }

  private async resolveOperationalContext(input: {
    tx?: Prisma.TransactionClient;
    tenantId: string;
    branchId: string;
    registerId: string;
    legalEntityId: string | null;
  }): Promise<OperationalContext> {
    const db = input.tx ?? this.prisma;
    const branch = await db.branch.findFirst({
      where: { id: input.branchId, tenantId: input.tenantId },
      select: { id: true, legalEntityId: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found in tenant.');
    }

    const register = await db.register.findFirst({
      where: { id: input.registerId, tenantId: input.tenantId },
      select: { id: true, branchId: true, legalEntityId: true },
    });
    if (!register) {
      throw new NotFoundException('Register not found in tenant.');
    }

    if (register.branchId !== input.branchId) {
      throw new ConflictException('Register must belong to the same branch.');
    }

    if (branch.legalEntityId && register.legalEntityId !== branch.legalEntityId) {
      throw new ConflictException('Register legal entity does not match branch.');
    }

    if (
      input.legalEntityId &&
      register.legalEntityId !== input.legalEntityId
    ) {
      throw new ConflictException(
        'Provided legalEntityId does not match register legal entity.',
      );
    }

    return {
      legalEntityId: input.legalEntityId ?? register.legalEntityId,
    };
  }

  private async resolveLineNo(
    tx: Prisma.TransactionClient,
    input: {
      model: 'cart' | 'return';
      sessionId: string;
      requestedLineNo?: number;
    },
  ) {
    const lineNo = input.requestedLineNo;
    if (lineNo != null) {
      if (!Number.isInteger(lineNo) || lineNo <= 0) {
        throw new BadRequestException('lineNo must be a positive integer.');
      }
      return lineNo;
    }

    if (input.model === 'cart') {
      const max = await tx.posCartLine.aggregate({
        where: { cartSessionId: input.sessionId },
        _max: { lineNo: true },
      });
      return (max._max.lineNo ?? 0) + 1;
    }

    const max = await tx.posReturnLine.aggregate({
      where: { returnSessionId: input.sessionId },
      _max: { lineNo: true },
    });
    return (max._max.lineNo ?? 0) + 1;
  }

  private async refreshCartTotals(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sessionId: string,
  ) {
    const lines = await tx.posCartLine.findMany({
      where: { tenantId, cartSessionId: sessionId },
      select: {
        quantity: true,
        unitPrice: true,
        discount: true,
        taxRate: true,
      },
    });
    const totals = this.computeTotals(
      lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate ?? 0,
      })),
    );
    await tx.posCartSession.update({
      where: { id: sessionId },
      data: {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      },
    });
    return totals;
  }

  private async refreshReturnTotals(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sessionId: string,
  ) {
    const lines = await tx.posReturnLine.findMany({
      where: { tenantId, returnSessionId: sessionId },
      select: {
        quantityReturned: true,
        unitPrice: true,
        discount: true,
        taxRate: true,
      },
    });
    const totals = this.computeTotals(
      lines.map((line) => ({
        quantity: line.quantityReturned,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate ?? 0,
      })),
    );
    await tx.posReturnSession.update({
      where: { id: sessionId },
      data: {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      },
    });
    return totals;
  }

  private computeTotals(
    lines: Array<{
      quantity: number;
      unitPrice: number;
      discount: number;
      taxRate: number;
    }>,
  ): Totals {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    for (const line of lines) {
      const base = line.quantity * line.unitPrice;
      const discount = Math.max(line.discount, 0);
      const taxable = Math.max(base - discount, 0);
      const tax = line.taxRate > 0 ? taxable * (line.taxRate / 100) : 0;
      subtotal += base;
      discountTotal += discount;
      taxTotal += tax;
    }

    const grandTotal = subtotal - discountTotal + taxTotal;
    return {
      subtotal: this.roundMoney(subtotal),
      discountTotal: this.roundMoney(discountTotal),
      taxTotal: this.roundMoney(taxTotal),
      grandTotal: this.roundMoney(grandTotal),
    };
  }

  private computeLineTotal(
    quantity: number,
    unitPrice: number,
    discount: number,
    taxRate: number,
  ) {
    const base = quantity * unitPrice;
    const discounted = Math.max(base - discount, 0);
    const tax = taxRate > 0 ? discounted * (taxRate / 100) : 0;
    return this.roundMoney(discounted + tax);
  }

  private async assertPackLotForSale(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    productPackId: string;
    lotBatchId: string;
  }) {
    const lotBatch = await this.assertPackLotLink(input);
    if (!lotBatch.isSellable || lotBatch.status === 'QUARANTINED') {
      throw new ConflictException('Lot batch is not sellable for POS sale.');
    }
    if (lotBatch.status === 'EXPIRED') {
      throw new ConflictException('Expired lot batch cannot be sold via POS.');
    }
  }

  private async assertPackLotLink(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    productPackId: string;
    lotBatchId: string;
  }) {
    const productPack = await input.tx.productPack.findFirst({
      where: { id: input.productPackId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!productPack) {
      throw new NotFoundException('Product pack not found in tenant.');
    }

    const lotBatch = await input.tx.lotBatch.findFirst({
      where: { id: input.lotBatchId, tenantId: input.tenantId },
      select: { id: true, productPackId: true, isSellable: true, status: true },
    });
    if (!lotBatch) {
      throw new NotFoundException('Lot batch not found in tenant.');
    }
    if (lotBatch.productPackId !== input.productPackId) {
      throw new ConflictException(
        'Lot batch must belong to the same product pack as the POS line.',
      );
    }
    return lotBatch;
  }

  private async applyInventoryLedgerMovement(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      legalEntityId: string | null;
      branchId: string;
      registerId: string;
      productPackId: string;
      lotBatchId: string;
      quantityDelta: number;
      entryType: 'STOCK_IN' | 'STOCK_OUT';
      referenceType: 'SALE' | 'RETURN';
      referenceId: string;
      referenceLineId: string;
      reasonCode: string;
      unitCost: number | null;
      amountTotal: number | null;
      createdBy: string | null;
    }) {
    const quantityDelta = Math.trunc(input.quantityDelta);
    const absoluteQuantity = Math.abs(quantityDelta);
    const bucketField: BucketFieldName = 'sellableQuantity';

    await tx.inventoryLotBalance.upsert({
      where: {
        tenantId_branchId_productPackId_lotBatchId: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          productPackId: input.productPackId,
          lotBatchId: input.lotBatchId,
        },
      },
      update: {},
      create: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        productPackId: input.productPackId,
        lotBatchId: input.lotBatchId,
        onHandQuantity: 0,
        sellableQuantity: 0,
        quarantinedQuantity: 0,
        expiredQuantity: 0,
      },
    });

    if (quantityDelta < 0) {
      const guarded = await tx.inventoryLotBalance.updateMany({
        where: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          productPackId: input.productPackId,
          lotBatchId: input.lotBatchId,
          onHandQuantity: { gte: absoluteQuantity },
          [bucketField]: { gte: absoluteQuantity },
        },
        data: {
          onHandQuantity: { decrement: absoluteQuantity },
          [bucketField]: { decrement: absoluteQuantity },
        } as Prisma.InventoryLotBalanceUpdateManyMutationInput,
      });
      if (guarded.count === 0) {
        throw new ConflictException('Insufficient lot balance for POS sale.');
      }
    } else {
      await tx.inventoryLotBalance.update({
        where: {
          tenantId_branchId_productPackId_lotBatchId: {
            tenantId: input.tenantId,
            branchId: input.branchId,
            productPackId: input.productPackId,
            lotBatchId: input.lotBatchId,
          },
        },
        data: {
          onHandQuantity: { increment: absoluteQuantity },
          [bucketField]: { increment: absoluteQuantity },
        } as Prisma.InventoryLotBalanceUpdateInput,
      });
    }

    return tx.inventoryLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId,
        registerId: input.registerId,
        productPackId: input.productPackId,
        lotBatchId: input.lotBatchId,
        entryType: input.entryType,
        postingSurface: 'REGISTER',
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        referenceLineId: input.referenceLineId,
        reasonCode: input.reasonCode,
        stockBucket: 'SELLABLE',
        quantityDelta,
        unitCost: input.unitCost,
        amountTotal: input.amountTotal,
        occurredAt: new Date(),
        createdBy: input.createdBy,
      },
    });
  }

  private async nextSequence(
    tx: Prisma.TransactionClient,
    tenantId: string,
    key: string,
  ) {
    const sequence = await tx.documentSequence.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    return sequence.nextNumber - 1;
  }

  private buildDocumentNo(prefix: string, sequenceNumber: number) {
    return `${prefix}-${new Date().getUTCFullYear()}-${sequenceNumber
      .toString()
      .padStart(6, '0')}`;
  }

  private assertPositiveInt(value: number, field: string) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer.`);
    }
  }

  private assertNonNegative(value: number, field: string) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be zero or greater.`);
    }
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async assertReturnSourceSaleDocument(input: {
    db: Prisma.TransactionClient | PrismaService;
    tenantId: string;
    sourceSaleDocumentId: string;
    branchId: string;
  }) {
    const source = await input.db.fiscalSaleDocument.findFirst({
      where: { id: input.sourceSaleDocumentId, tenantId: input.tenantId },
      select: { id: true, branchId: true, state: true },
    });
    if (!source) {
      throw new NotFoundException('Source fiscal sale document not found in tenant.');
    }
    if (source.branchId !== input.branchId) {
      throw new ConflictException(
        'Source fiscal sale document must belong to the same branch.',
      );
    }
    if (!(RETURN_ELIGIBLE_SALE_STATES as readonly string[]).includes(source.state)) {
      throw new ConflictException(
        'Return session requires source fiscal sale document state FINALIZED or ACCEPTED.',
      );
    }
  }

  private async assertReturnSessionLineCaps(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      returnSessionId: string;
      returnLines: Array<{
        sourceSaleLineId: string | null;
        quantityReturned: number;
      }>;
    },
  ) {
    const grouped = new Map<string, number>();
    for (const line of input.returnLines) {
      if (!line.sourceSaleLineId) {
        continue;
      }
      grouped.set(
        line.sourceSaleLineId,
        (grouped.get(line.sourceSaleLineId) ?? 0) + line.quantityReturned,
      );
    }

    for (const [sourceSaleLineId, sessionQty] of grouped.entries()) {
      const sourceLine = await tx.fiscalSaleDocumentLine.findFirst({
        where: { id: sourceSaleLineId, tenantId: input.tenantId },
        select: { id: true, quantity: true },
      });
      if (!sourceLine) {
        throw new NotFoundException('Source fiscal sale line not found in tenant.');
      }

      const finalizedReturned = await tx.fiscalReturnDocumentLine.aggregate({
        where: {
          tenantId: input.tenantId,
          sourceSaleLineId,
          returnDocument: {
            state: { in: ['FINALIZED', 'QUEUED', 'ACCEPTED'] },
          },
        },
        _sum: { quantity: true },
      });
      const alreadyReturned = finalizedReturned._sum.quantity ?? 0;
      const remaining = sourceLine.quantity - alreadyReturned;
      if (sessionQty > remaining) {
        throw new ConflictException(
          `Return quantity exceeds remaining source sale quantity (${remaining}) for line ${sourceSaleLineId}.`,
        );
      }
    }
  }
}
