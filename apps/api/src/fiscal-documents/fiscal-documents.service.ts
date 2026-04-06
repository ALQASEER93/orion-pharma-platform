import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FiscalDocumentState, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFiscalCreditNoteDocumentInput } from './dto/create-fiscal-credit-note-document.input';
import { CreateFiscalReturnDocumentInput } from './dto/create-fiscal-return-document.input';
import { CreateFiscalSaleDocumentInput } from './dto/create-fiscal-sale-document.input';
import { TransitionFiscalDocumentStateInput } from './dto/transition-fiscal-document-state.input';

const ALLOWED_TRANSITIONS: Record<
  FiscalDocumentState,
  ReadonlySet<FiscalDocumentState>
> = {
  DRAFT: new Set(['FINALIZED', 'CANCELLED']),
  FINALIZED: new Set(['QUEUED', 'CANCELLED']),
  QUEUED: new Set(['ACCEPTED', 'REJECTED', 'CANCELLED']),
  ACCEPTED: new Set(['CANCELLED']),
  REJECTED: new Set(['QUEUED', 'CANCELLED']),
  CANCELLED: new Set(),
};

type BranchContext = {
  legalEntityId: string | null;
  registerId: string | null;
};

type WithOptionalLineNo = {
  lineNo?: number;
};

@Injectable()
export class FiscalDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSaleDocument(input: CreateFiscalSaleDocumentInput) {
    this.assertDocumentNo(input.documentNo);
    this.assertLinesPresent(input.lines);
    const lines = this.normalizeLineNumbers(input.lines);
    const branchContext = await this.resolveBranchContext({
      tenantId: input.tenantId,
      branchId: input.branchId,
      legalEntityId: input.legalEntityId ?? null,
      registerId: input.registerId ?? null,
    });

    for (const line of lines) {
      this.assertLineAmounts(line.quantity, line.unitPrice);
      await this.assertPackLotLink({
        tenantId: input.tenantId,
        productPackId: line.productPackId,
        lotBatchId: line.lotBatchId ?? null,
      });
    }

    try {
      return await this.prisma.fiscalSaleDocument.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: branchContext.legalEntityId,
          branchId: input.branchId,
          registerId: branchContext.registerId,
          documentNo: input.documentNo.trim(),
          currency: input.currency ?? 'JOD',
          subtotal: input.subtotal ?? 0,
          discountTotal: input.discountTotal ?? 0,
          taxTotal: input.taxTotal ?? 0,
          grandTotal: input.grandTotal ?? 0,
          inventoryAnchorReferenceId: input.inventoryAnchorReferenceId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          lines: {
            create: lines.map((line) => ({
              tenantId: input.tenantId,
              lineNo: line.lineNo,
              productPackId: line.productPackId,
              lotBatchId: line.lotBatchId ?? null,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount ?? 0,
              taxRate: line.taxRate ?? null,
              lineTotal:
                line.lineTotal ??
                this.deriveLineTotal(
                  line.quantity,
                  line.unitPrice,
                  line.discount ?? 0,
                  line.taxRate ?? 0,
                ),
              referenceKey: line.referenceKey ?? null,
            })),
          },
        },
      });
    } catch (error) {
      this.rethrowDuplicateAsConflict(error, 'Fiscal sale document number already exists in tenant.');
      throw error;
    }
  }

  async createReturnDocument(input: CreateFiscalReturnDocumentInput) {
    this.assertDocumentNo(input.documentNo);
    this.assertLinesPresent(input.lines);
    const lines = this.normalizeLineNumbers(input.lines);
    const branchContext = await this.resolveBranchContext({
      tenantId: input.tenantId,
      branchId: input.branchId,
      legalEntityId: input.legalEntityId ?? null,
      registerId: input.registerId ?? null,
    });

    const sourceSale = input.sourceSaleDocumentId
      ? await this.prisma.fiscalSaleDocument.findFirst({
          where: {
            id: input.sourceSaleDocumentId,
            tenantId: input.tenantId,
          },
          select: { id: true, branchId: true, legalEntityId: true },
        })
      : null;
    if (input.sourceSaleDocumentId && !sourceSale) {
      throw new NotFoundException('Source fiscal sale document not found in tenant.');
    }

    if (sourceSale && sourceSale.branchId !== input.branchId) {
      throw new ConflictException(
        'Fiscal return must reference a source sale from the same branch.',
      );
    }

    for (const line of lines) {
      this.assertLineAmounts(line.quantity, line.unitPrice);
      await this.assertPackLotLink({
        tenantId: input.tenantId,
        productPackId: line.productPackId,
        lotBatchId: line.lotBatchId ?? null,
      });

      if (line.sourceSaleLineId) {
        const sourceSaleLine = await this.prisma.fiscalSaleDocumentLine.findFirst({
          where: {
            id: line.sourceSaleLineId,
            tenantId: input.tenantId,
          },
          select: { id: true, saleDocumentId: true },
        });
        if (!sourceSaleLine) {
          throw new NotFoundException('Source fiscal sale line not found in tenant.');
        }
        if (
          input.sourceSaleDocumentId &&
          sourceSaleLine.saleDocumentId !== input.sourceSaleDocumentId
        ) {
          throw new ConflictException(
            'Return line source sale line must belong to sourceSaleDocumentId.',
          );
        }
      }
    }

    try {
      return await this.prisma.fiscalReturnDocument.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: branchContext.legalEntityId,
          branchId: input.branchId,
          registerId: branchContext.registerId,
          sourceSaleDocumentId: input.sourceSaleDocumentId ?? null,
          documentNo: input.documentNo.trim(),
          currency: input.currency ?? 'JOD',
          subtotal: input.subtotal ?? 0,
          discountTotal: input.discountTotal ?? 0,
          taxTotal: input.taxTotal ?? 0,
          grandTotal: input.grandTotal ?? 0,
          inventoryAnchorReferenceId: input.inventoryAnchorReferenceId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          lines: {
            create: lines.map((line) => ({
              tenantId: input.tenantId,
              sourceSaleLineId: line.sourceSaleLineId ?? null,
              lineNo: line.lineNo,
              productPackId: line.productPackId,
              lotBatchId: line.lotBatchId ?? null,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount ?? 0,
              taxRate: line.taxRate ?? null,
              lineTotal:
                line.lineTotal ??
                this.deriveLineTotal(
                  line.quantity,
                  line.unitPrice,
                  line.discount ?? 0,
                  line.taxRate ?? 0,
                ),
              reasonCode: line.reasonCode ?? null,
            })),
          },
        },
      });
    } catch (error) {
      this.rethrowDuplicateAsConflict(
        error,
        'Fiscal return document number already exists in tenant.',
      );
      throw error;
    }
  }

  async createCreditNoteDocument(input: CreateFiscalCreditNoteDocumentInput) {
    this.assertDocumentNo(input.documentNo);
    this.assertLinesPresent(input.lines);
    if (!input.sourceSaleDocumentId && !input.sourceReturnDocumentId) {
      throw new BadRequestException(
        'Credit note must reference sourceSaleDocumentId or sourceReturnDocumentId.',
      );
    }

    const lines = this.normalizeLineNumbers(input.lines);
    const branchContext = await this.resolveBranchContext({
      tenantId: input.tenantId,
      branchId: input.branchId,
      legalEntityId: input.legalEntityId ?? null,
      registerId: input.registerId ?? null,
    });

    const sourceSale = input.sourceSaleDocumentId
      ? await this.prisma.fiscalSaleDocument.findFirst({
          where: {
            id: input.sourceSaleDocumentId,
            tenantId: input.tenantId,
          },
          select: {
            id: true,
            branchId: true,
            legalEntityId: true,
            creditState: true,
          },
        })
      : null;
    if (input.sourceSaleDocumentId && !sourceSale) {
      throw new NotFoundException('Source fiscal sale document not found in tenant.');
    }

    const sourceReturn = input.sourceReturnDocumentId
      ? await this.prisma.fiscalReturnDocument.findFirst({
          where: {
            id: input.sourceReturnDocumentId,
            tenantId: input.tenantId,
          },
          select: { id: true, branchId: true, sourceSaleDocumentId: true },
        })
      : null;
    if (input.sourceReturnDocumentId && !sourceReturn) {
      throw new NotFoundException('Source fiscal return document not found in tenant.');
    }

    if (sourceSale && sourceSale.branchId !== input.branchId) {
      throw new ConflictException(
        'Credit note source sale must belong to the same branch.',
      );
    }

    if (sourceReturn && sourceReturn.branchId !== input.branchId) {
      throw new ConflictException(
        'Credit note source return must belong to the same branch.',
      );
    }

    if (
      sourceSale &&
      sourceReturn?.sourceSaleDocumentId &&
      sourceReturn.sourceSaleDocumentId !== sourceSale.id
    ) {
      throw new ConflictException(
        'sourceSaleDocumentId does not match sourceReturnDocumentId linkage.',
      );
    }

    for (const line of lines) {
      this.assertLineAmounts(line.quantity, line.unitPrice);
      if (line.lotBatchId && !line.productPackId) {
        throw new BadRequestException(
          'lotBatchId requires productPackId on credit-note lines.',
        );
      }

      if (line.productPackId) {
        await this.assertPackLotLink({
          tenantId: input.tenantId,
          productPackId: line.productPackId,
          lotBatchId: line.lotBatchId ?? null,
        });
      }

      if (line.sourceSaleLineId) {
        const sourceSaleLine = await this.prisma.fiscalSaleDocumentLine.findFirst({
          where: {
            id: line.sourceSaleLineId,
            tenantId: input.tenantId,
          },
          select: { id: true, saleDocumentId: true },
        });
        if (!sourceSaleLine) {
          throw new NotFoundException('Credit note source sale line not found in tenant.');
        }
        if (
          input.sourceSaleDocumentId &&
          sourceSaleLine.saleDocumentId !== input.sourceSaleDocumentId
        ) {
          throw new ConflictException(
            'Credit note source sale line must belong to sourceSaleDocumentId.',
          );
        }
      }

      if (line.sourceReturnLineId) {
        const sourceReturnLine =
          await this.prisma.fiscalReturnDocumentLine.findFirst({
            where: {
              id: line.sourceReturnLineId,
              tenantId: input.tenantId,
            },
            select: { id: true, returnDocumentId: true },
          });
        if (!sourceReturnLine) {
          throw new NotFoundException(
            'Credit note source return line not found in tenant.',
          );
        }
        if (
          input.sourceReturnDocumentId &&
          sourceReturnLine.returnDocumentId !== input.sourceReturnDocumentId
        ) {
          throw new ConflictException(
            'Credit note source return line must belong to sourceReturnDocumentId.',
          );
        }
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.fiscalCreditNoteDocument.create({
          data: {
            tenantId: input.tenantId,
            legalEntityId: branchContext.legalEntityId,
            branchId: input.branchId,
            registerId: branchContext.registerId,
            sourceSaleDocumentId: input.sourceSaleDocumentId ?? null,
            sourceReturnDocumentId: input.sourceReturnDocumentId ?? null,
            documentNo: input.documentNo.trim(),
            currency: input.currency ?? 'JOD',
            subtotal: input.subtotal ?? 0,
            discountTotal: input.discountTotal ?? 0,
            taxTotal: input.taxTotal ?? 0,
            grandTotal: input.grandTotal ?? 0,
            inventoryAnchorReferenceId: input.inventoryAnchorReferenceId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            lines: {
              create: lines.map((line) => ({
                tenantId: input.tenantId,
                sourceSaleLineId: line.sourceSaleLineId ?? null,
                sourceReturnLineId: line.sourceReturnLineId ?? null,
                lineNo: line.lineNo,
                productPackId: line.productPackId ?? null,
                lotBatchId: line.lotBatchId ?? null,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: line.discount ?? 0,
                taxRate: line.taxRate ?? null,
                lineTotal:
                  line.lineTotal ??
                  this.deriveLineTotal(
                    line.quantity,
                    line.unitPrice,
                    line.discount ?? 0,
                    line.taxRate ?? 0,
                  ),
                reasonCode: line.reasonCode ?? null,
              })),
            },
          },
        });

        if (sourceSale && sourceSale.creditState === 'NONE') {
          await tx.fiscalSaleDocument.update({
            where: { id: sourceSale.id },
            data: { creditState: 'PARTIALLY_CREDITED' },
          });
        }

        return created;
      });
    } catch (error) {
      this.rethrowDuplicateAsConflict(
        error,
        'Fiscal credit note document number already exists in tenant.',
      );
      throw error;
    }
  }

  async transitionState(input: TransitionFiscalDocumentStateInput) {
    const reason = input.reason?.trim() ?? '';
    if (input.toState === 'REJECTED' && !reason) {
      throw new BadRequestException('Reason is required when rejecting a document.');
    }
    if (input.toState === 'CANCELLED' && !reason) {
      throw new BadRequestException('Reason is required when cancelling a document.');
    }

    const now = new Date();
    switch (input.documentKind) {
      case 'SALE': {
        const current = await this.prisma.fiscalSaleDocument.findFirst({
          where: { id: input.documentId, tenantId: input.tenantId },
          select: { id: true, state: true },
        });
        if (!current) {
          throw new NotFoundException('Fiscal sale document not found in tenant.');
        }
        this.assertTransitionAllowed(current.state, input.toState);
        return this.prisma.fiscalSaleDocument.update({
          where: { id: input.documentId },
          data: this.buildTransitionUpdate(input.toState, reason, now),
        });
      }
      case 'RETURN': {
        const current = await this.prisma.fiscalReturnDocument.findFirst({
          where: { id: input.documentId, tenantId: input.tenantId },
          select: { id: true, state: true },
        });
        if (!current) {
          throw new NotFoundException('Fiscal return document not found in tenant.');
        }
        this.assertTransitionAllowed(current.state, input.toState);
        return this.prisma.fiscalReturnDocument.update({
          where: { id: input.documentId },
          data: this.buildTransitionUpdate(input.toState, reason, now),
        });
      }
      case 'CREDIT_NOTE': {
        const current = await this.prisma.fiscalCreditNoteDocument.findFirst({
          where: { id: input.documentId, tenantId: input.tenantId },
          select: { id: true, state: true },
        });
        if (!current) {
          throw new NotFoundException('Fiscal credit note document not found in tenant.');
        }
        this.assertTransitionAllowed(current.state, input.toState);
        return this.prisma.fiscalCreditNoteDocument.update({
          where: { id: input.documentId },
          data: this.buildTransitionUpdate(input.toState, reason, now),
        });
      }
    }
  }

  private async resolveBranchContext(input: {
    tenantId: string;
    branchId: string;
    legalEntityId: string | null;
    registerId: string | null;
  }): Promise<BranchContext> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: input.branchId,
        tenantId: input.tenantId,
      },
      select: { id: true, legalEntityId: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found in tenant.');
    }

    if (
      input.legalEntityId &&
      branch.legalEntityId &&
      input.legalEntityId !== branch.legalEntityId
    ) {
      throw new ConflictException(
        'Provided legalEntityId does not match branch legal entity.',
      );
    }

    let resolvedLegalEntityId = input.legalEntityId ?? branch.legalEntityId ?? null;
    if (!input.registerId) {
      return {
        legalEntityId: resolvedLegalEntityId,
        registerId: null,
      };
    }

    const register = await this.prisma.register.findFirst({
      where: {
        id: input.registerId,
        tenantId: input.tenantId,
      },
      select: { id: true, branchId: true, legalEntityId: true },
    });
    if (!register) {
      throw new NotFoundException('Register not found in tenant.');
    }

    if (register.branchId !== input.branchId) {
      throw new ConflictException(
        'Register must belong to the same branch as the fiscal document.',
      );
    }

    if (
      branch.legalEntityId &&
      register.legalEntityId !== branch.legalEntityId
    ) {
      throw new ConflictException(
        'Register legal entity does not match branch legal entity.',
      );
    }

    if (resolvedLegalEntityId && register.legalEntityId !== resolvedLegalEntityId) {
      throw new ConflictException(
        'Register legal entity does not match provided legal entity.',
      );
    }

    resolvedLegalEntityId = register.legalEntityId;
    return {
      legalEntityId: resolvedLegalEntityId,
      registerId: register.id,
    };
  }

  private async assertPackLotLink(input: {
    tenantId: string;
    productPackId: string;
    lotBatchId: string | null;
  }) {
    const productPack = await this.prisma.productPack.findFirst({
      where: {
        id: input.productPackId,
        tenantId: input.tenantId,
      },
      select: { id: true },
    });
    if (!productPack) {
      throw new NotFoundException('Product pack not found in tenant.');
    }

    if (!input.lotBatchId) {
      return;
    }

    const lotBatch = await this.prisma.lotBatch.findFirst({
      where: {
        id: input.lotBatchId,
        tenantId: input.tenantId,
      },
      select: { id: true, productPackId: true },
    });
    if (!lotBatch) {
      throw new NotFoundException('Lot batch not found in tenant.');
    }
    if (lotBatch.productPackId !== input.productPackId) {
      throw new ConflictException(
        'Lot batch must belong to the same product pack as the fiscal line.',
      );
    }
  }

  private assertTransitionAllowed(
    from: FiscalDocumentState,
    to: FiscalDocumentState,
  ) {
    if (from === to) {
      return;
    }
    if (!ALLOWED_TRANSITIONS[from].has(to)) {
      throw new ConflictException(`Transition from ${from} to ${to} is not allowed.`);
    }
  }

  private buildTransitionUpdate(
    state: FiscalDocumentState,
    reason: string,
    at: Date,
  ) {
    return {
      state,
      ...(state === 'FINALIZED' ? { finalizedAt: at } : {}),
      ...(state === 'QUEUED' ? { queuedAt: at } : {}),
      ...(state === 'ACCEPTED' ? { acceptedAt: at } : {}),
      ...(state === 'REJECTED' ? { rejectedAt: at, rejectionReason: reason } : {}),
      ...(state === 'CANCELLED'
        ? { cancelledAt: at, cancellationReason: reason }
        : {}),
    };
  }

  private assertDocumentNo(documentNo: string) {
    if (!documentNo || !documentNo.trim()) {
      throw new BadRequestException('documentNo is required.');
    }
  }

  private assertLinesPresent(lines: unknown[]) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('At least one fiscal line is required.');
    }
  }

  private assertLineAmounts(quantity: number, unitPrice: number) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Line quantity must be greater than zero.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new BadRequestException('Line unitPrice must be zero or greater.');
    }
  }

  private normalizeLineNumbers<T extends WithOptionalLineNo>(
    lines: T[],
  ): Array<T & { lineNo: number }> {
    const seen = new Set<number>();
    return lines.map((line, index) => {
      const lineNo = line.lineNo ?? index + 1;
      if (!Number.isInteger(lineNo) || lineNo <= 0) {
        throw new BadRequestException('lineNo must be a positive integer.');
      }
      if (seen.has(lineNo)) {
        throw new ConflictException('lineNo values must be unique per document.');
      }
      seen.add(lineNo);
      return {
        ...line,
        lineNo,
      };
    });
  }

  private deriveLineTotal(
    quantity: number,
    unitPrice: number,
    discount: number,
    taxRate: number,
  ) {
    const base = quantity * unitPrice;
    const discounted = base - discount;
    const tax = taxRate > 0 ? discounted * taxRate : 0;
    return discounted + tax;
  }

  private rethrowDuplicateAsConflict(error: unknown, message: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}
