import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierStockReceiptInput } from './dto/create-supplier-stock-receipt.input';
import { CreateSupplierStockReturnInput } from './dto/create-supplier-stock-return.input';

type BucketFieldName =
  | 'sellableQuantity'
  | 'quarantinedQuantity'
  | 'expiredQuantity';

@Injectable()
export class ProcurementReceivingService {
  constructor(private readonly prisma: PrismaService) {}

  async createSupplierStockReceipt(input: CreateSupplierStockReceiptInput) {
    this.assertDocumentNumber(input.receiptNumber, 'receiptNumber');
    this.assertLinesPresent(input.lines);
    const lines = this.normalizeLineNumbers(input.lines);
    const context = await this.resolveOperationalContext({
      tenantId: input.tenantId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      legalEntityId: input.legalEntityId ?? null,
    });

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.supplierStockReceipt.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: input.branchId,
          supplierId: input.supplierId,
          receiptNumber: input.receiptNumber.trim(),
          state: 'POSTED',
          notes: input.notes ?? null,
          receivedAt: input.receivedAt ?? new Date(),
          createdBy: input.createdBy ?? null,
        },
      });

      for (const line of lines) {
        this.assertPositiveInteger(line.quantityReceived, 'quantityReceived');
        if (line.unitCost != null && line.unitCost < 0) {
          throw new BadRequestException('unitCost must be zero or greater.');
        }
        await this.assertPackLotLink({
          tenantId: input.tenantId,
          productPackId: line.productPackId,
          lotBatchId: line.lotBatchId,
        });

        const receiptLine = await tx.supplierStockReceiptLine.create({
          data: {
            receiptId: receipt.id,
            tenantId: input.tenantId,
            lineNo: line.lineNo,
            productPackId: line.productPackId,
            lotBatchId: line.lotBatchId,
            quantityReceived: line.quantityReceived,
            unitCost: line.unitCost ?? null,
            lineTotal:
              line.lineTotal ??
              (line.unitCost != null
                ? line.unitCost * line.quantityReceived
                : null),
            notes: line.notes ?? null,
          },
        });

        const ledgerEntry = await this.applyInventoryLedgerMovement(tx, {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: input.branchId,
          productPackId: line.productPackId,
          lotBatchId: line.lotBatchId,
          quantityDelta: line.quantityReceived,
          entryType: 'STOCK_IN',
          referenceType: 'SUPPLIER_RECEIPT',
          referenceId: receipt.id,
          referenceLineId: receiptLine.id,
          reasonCode: 'SUPPLIER_STOCK_IN',
          unitCost: line.unitCost ?? null,
          amountTotal:
            line.lineTotal ??
            (line.unitCost != null
              ? line.unitCost * line.quantityReceived
              : null),
          createdBy: input.createdBy ?? null,
        });

        await tx.supplierStockReceiptLine.update({
          where: { id: receiptLine.id },
          data: { inventoryLedgerEntryId: ledgerEntry.id },
        });
      }

      return tx.supplierStockReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        include: {
          lines: true,
        },
      });
    });
  }

  async createSupplierStockReturn(input: CreateSupplierStockReturnInput) {
    this.assertDocumentNumber(input.returnNumber, 'returnNumber');
    this.assertLinesPresent(input.lines);
    const lines = this.normalizeLineNumbers(input.lines);
    const context = await this.resolveOperationalContext({
      tenantId: input.tenantId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      legalEntityId: input.legalEntityId ?? null,
    });

    if (input.sourceReceiptId) {
      const sourceReceipt = await this.prisma.supplierStockReceipt.findFirst({
        where: {
          id: input.sourceReceiptId,
          tenantId: input.tenantId,
          supplierId: input.supplierId,
        },
        select: { id: true, branchId: true },
      });
      if (!sourceReceipt) {
        throw new NotFoundException(
          'Source supplier stock receipt not found in tenant/supplier context.',
        );
      }
      if (sourceReceipt.branchId !== input.branchId) {
        throw new ConflictException(
          'Source supplier stock receipt must belong to the same branch.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const supplierReturn = await tx.supplierStockReturn.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: input.branchId,
          supplierId: input.supplierId,
          sourceReceiptId: input.sourceReceiptId ?? null,
          returnNumber: input.returnNumber.trim(),
          state: 'POSTED',
          reasonCode: input.reasonCode ?? null,
          notes: input.notes ?? null,
          returnedAt: input.returnedAt ?? new Date(),
          createdBy: input.createdBy ?? null,
        },
      });

      for (const line of lines) {
        this.assertPositiveInteger(line.quantityReturned, 'quantityReturned');
        await this.assertPackLotLink({
          tenantId: input.tenantId,
          productPackId: line.productPackId,
          lotBatchId: line.lotBatchId,
        });

        let sourceReceiptLine:
          | {
              id: string;
              receiptId: string;
              productPackId: string;
              lotBatchId: string;
              quantityReceived: number;
              returnedQuantity: number;
            }
          | null = null;
        if (line.sourceReceiptLineId) {
          sourceReceiptLine = await tx.supplierStockReceiptLine.findFirst({
            where: {
              id: line.sourceReceiptLineId,
              tenantId: input.tenantId,
            },
            select: {
              id: true,
              receiptId: true,
              productPackId: true,
              lotBatchId: true,
              quantityReceived: true,
              returnedQuantity: true,
            },
          });
          if (!sourceReceiptLine) {
            throw new NotFoundException('Source supplier stock receipt line not found.');
          }
          if (
            input.sourceReceiptId &&
            sourceReceiptLine.receiptId !== input.sourceReceiptId
          ) {
            throw new ConflictException(
              'sourceReceiptLineId must belong to sourceReceiptId.',
            );
          }
          if (sourceReceiptLine.productPackId !== line.productPackId) {
            throw new ConflictException(
              'sourceReceiptLineId product pack does not match return line product pack.',
            );
          }
          if (sourceReceiptLine.lotBatchId !== line.lotBatchId) {
            throw new ConflictException(
              'sourceReceiptLineId lot batch does not match return line lot batch.',
            );
          }
          if (
            sourceReceiptLine.returnedQuantity + line.quantityReturned >
            sourceReceiptLine.quantityReceived
          ) {
            throw new ConflictException(
              'Return quantity exceeds available quantity on source receipt line.',
            );
          }
        }

        const returnLine = await tx.supplierStockReturnLine.create({
          data: {
            returnId: supplierReturn.id,
            tenantId: input.tenantId,
            sourceReceiptLineId: line.sourceReceiptLineId ?? null,
            lineNo: line.lineNo,
            productPackId: line.productPackId,
            lotBatchId: line.lotBatchId,
            quantityReturned: line.quantityReturned,
            reasonCode: line.reasonCode ?? null,
            notes: line.notes ?? null,
          },
        });

        const ledgerEntry = await this.applyInventoryLedgerMovement(tx, {
          tenantId: input.tenantId,
          legalEntityId: context.legalEntityId,
          branchId: input.branchId,
          productPackId: line.productPackId,
          lotBatchId: line.lotBatchId,
          quantityDelta: -line.quantityReturned,
          entryType: 'STOCK_OUT',
          referenceType: 'SUPPLIER_RETURN',
          referenceId: supplierReturn.id,
          referenceLineId: returnLine.id,
          reasonCode: line.reasonCode ?? input.reasonCode ?? 'RETURN_TO_SUPPLIER',
          unitCost: null,
          amountTotal: null,
          createdBy: input.createdBy ?? null,
        });

        await tx.supplierStockReturnLine.update({
          where: { id: returnLine.id },
          data: { inventoryLedgerEntryId: ledgerEntry.id },
        });

        if (sourceReceiptLine) {
          await tx.supplierStockReceiptLine.update({
            where: { id: sourceReceiptLine.id },
            data: {
              returnedQuantity: { increment: line.quantityReturned },
            },
          });
        }
      }

      return tx.supplierStockReturn.findUniqueOrThrow({
        where: { id: supplierReturn.id },
        include: {
          lines: true,
        },
      });
    });
  }

  private async resolveOperationalContext(input: {
    tenantId: string;
    branchId: string;
    supplierId: string;
    legalEntityId: string | null;
  }) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, tenantId: input.tenantId },
      select: { id: true, legalEntityId: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found in tenant.');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found in tenant.');
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

    return {
      legalEntityId: input.legalEntityId ?? branch.legalEntityId ?? null,
    };
  }

  private async assertPackLotLink(input: {
    tenantId: string;
    productPackId: string;
    lotBatchId: string;
  }) {
    const productPack = await this.prisma.productPack.findFirst({
      where: { id: input.productPackId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!productPack) {
      throw new NotFoundException('Product pack not found in tenant.');
    }

    const lotBatch = await this.prisma.lotBatch.findFirst({
      where: { id: input.lotBatchId, tenantId: input.tenantId },
      select: { id: true, productPackId: true },
    });
    if (!lotBatch) {
      throw new NotFoundException('Lot batch not found in tenant.');
    }
    if (lotBatch.productPackId !== input.productPackId) {
      throw new ConflictException(
        'Lot batch must belong to the same product pack for receiving/return lines.',
      );
    }
  }

  private async applyInventoryLedgerMovement(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      legalEntityId: string | null;
      branchId: string;
      productPackId: string;
      lotBatchId: string;
      quantityDelta: number;
      entryType: 'STOCK_IN' | 'STOCK_OUT';
      referenceType: 'SUPPLIER_RECEIPT' | 'SUPPLIER_RETURN';
      referenceId: string;
      referenceLineId: string;
      reasonCode: string;
      unitCost: number | null;
      amountTotal: number | null;
      createdBy: string | null;
    },
  ) {
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
      const guardedUpdate = await tx.inventoryLotBalance.updateMany({
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

      if (guardedUpdate.count === 0) {
        throw new ConflictException(
          'Insufficient on-hand quantity for supplier stock return movement.',
        );
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
        registerId: null,
        productPackId: input.productPackId,
        lotBatchId: input.lotBatchId,
        entryType: input.entryType,
        postingSurface: 'BRANCH',
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

  private assertDocumentNumber(value: string, fieldName: string) {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
  }

  private assertLinesPresent(lines: unknown[]) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('At least one line is required.');
    }
  }

  private assertPositiveInteger(value: number, fieldName: string) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${fieldName} must be a positive integer.`);
    }
  }

  private normalizeLineNumbers<T extends { lineNo?: number }>(
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
      return { ...line, lineNo };
    });
  }
}
