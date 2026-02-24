import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma, TrackingMode } from '@prisma/client';
import { createHash } from 'crypto';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcurementAdjustmentDto } from './dto/create-procurement-adjustment.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { QueryPurchaseReturnsDto } from './dto/query-purchase-returns.dto';

const PURCHASE_RETURN_SEQUENCE_KEY = 'PURCHASE_RETURN';
const PROCUREMENT_ADJUSTMENT_SEQUENCE_KEY = 'PROCUREMENT_ADJUSTMENT';

@Injectable()
export class ProcurementTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPurchaseReturns(tenantId: string, query: QueryPurchaseReturnsDto) {
    const where: Prisma.PurchaseReturnWhereInput = {
      tenantId,
      ...(query.goodsReceiptId ? { goodsReceiptId: query.goodsReceiptId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.returnedFrom || query.returnedTo
        ? {
            returnedAt: {
              ...(query.returnedFrom
                ? { gte: new Date(query.returnedFrom) }
                : {}),
              ...(query.returnedTo ? { lte: new Date(query.returnedTo) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { returnNumber: { contains: query.q } },
              { goodsReceipt: { grnNumber: { contains: query.q } } },
            ],
          }
        : {}),
    };

    const records = await this.prisma.purchaseReturn.findMany({
      where,
      orderBy: [{ returnedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: true,
        branch: true,
        goodsReceipt: true,
        lines: {
          include: {
            product: true,
            goodsReceiptLine: true,
          },
        },
      },
    });

    return records.map((record) => this.toReturnResponse(record));
  }

  async createPurchaseReturn(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreatePurchaseReturnDto,
  ) {
    if (!user) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    const payloadHash = this.hashPurchaseReturnPayload(dto);

    try {
      return await this.prisma.$transaction((tx) =>
        this.createPurchaseReturnInTransaction(
          tx,
          tenantId,
          user,
          dto,
          payloadHash,
        ),
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const replay = await this.prisma.purchaseReturn.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: {
          supplier: true,
          branch: true,
          goodsReceipt: true,
          lines: {
            include: {
              product: true,
              goodsReceiptLine: true,
            },
          },
        },
      });

      if (!replay) {
        throw error;
      }

      if (replay.payloadHash !== payloadHash) {
        throw new ConflictException(
          'Idempotency key already used with different payload.',
        );
      }

      return this.toReturnResponse(replay);
    }
  }

  private async createPurchaseReturnInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    user: JwtUserPayload,
    dto: CreatePurchaseReturnDto,
    payloadHash: string,
  ) {
    const replay = await tx.purchaseReturn.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: {
        supplier: true,
        branch: true,
        goodsReceipt: true,
        lines: {
          include: {
            product: true,
            goodsReceiptLine: true,
          },
        },
      },
    });

    if (replay) {
      if (replay.payloadHash !== payloadHash) {
        throw new ConflictException(
          'Idempotency key already used with different payload.',
        );
      }

      return this.toReturnResponse(replay);
    }

    const goodsReceipt = await tx.goodsReceipt.findFirst({
      where: {
        id: dto.goodsReceiptId,
        tenantId,
      },
      include: {
        lines: {
          include: {
            product: {
              select: {
                id: true,
                trackingMode: true,
              },
            },
          },
        },
      },
    });

    if (!goodsReceipt) {
      throw new NotFoundException('Goods receipt not found.');
    }

    const receiptLineMap = new Map(
      goodsReceipt.lines.map((line) => [
        line.id,
        {
          id: line.id,
          productId: line.productId,
          qtyReceivedNow: line.qtyReceivedNow,
          returnedQuantity: line.returnedQuantity,
          trackingMode: line.product.trackingMode,
          batchNo: line.batchNo,
          expiryDate: line.expiryDate,
        },
      ]),
    );

    const aggregateQty = new Map<string, number>();
    const lineCreates: Array<{
      goodsReceiptLineId: string;
      tenantId: string;
      productId: string;
      inventoryMovementId: string;
      qtyReturnedNow: number;
      reasonCode?: string;
      batchNo?: string;
      expiryDate?: Date;
      notes?: string;
    }> = [];

    for (const line of dto.lines) {
      const receiptLine = receiptLineMap.get(line.goodsReceiptLineId);
      if (!receiptLine) {
        throw new NotFoundException(
          `Goods receipt line not found: ${line.goodsReceiptLineId}`,
        );
      }

      if (line.qtyReturnNow <= 0) {
        throw new BadRequestException('qtyReturnNow must be greater than 0.');
      }

      aggregateQty.set(
        line.goodsReceiptLineId,
        (aggregateQty.get(line.goodsReceiptLineId) ?? 0) + line.qtyReturnNow,
      );
    }

    for (const [lineId, qty] of aggregateQty.entries()) {
      const source = receiptLineMap.get(lineId);
      const guarded = await tx.goodsReceiptLine.updateMany({
        where: {
          id: lineId,
          tenantId,
          goodsReceiptId: goodsReceipt.id,
          returnedQuantity: {
            lte: (source?.qtyReceivedNow ?? 0) - qty,
          },
        },
        data: {
          returnedQuantity: {
            increment: qty,
          },
        },
      });

      if (guarded.count === 0) {
        throw new ConflictException(`Over-return conflict on line ${lineId}.`);
      }
    }

    const sequence = await tx.documentSequence.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: PURCHASE_RETURN_SEQUENCE_KEY,
        },
      },
      create: {
        tenantId,
        key: PURCHASE_RETURN_SEQUENCE_KEY,
        nextNumber: 2,
      },
      update: {
        nextNumber: {
          increment: 1,
        },
      },
    });

    const sequenceNumber = sequence.nextNumber - 1;
    const returnNumber = `PRN-${new Date().getUTCFullYear()}-${sequenceNumber
      .toString()
      .padStart(6, '0')}`;

    for (const line of dto.lines) {
      const receiptLine = receiptLineMap.get(line.goodsReceiptLineId);
      if (!receiptLine) {
        throw new NotFoundException(
          `Goods receipt line not found: ${line.goodsReceiptLineId}`,
        );
      }

      const movement = await this.applyBalanceDelta(tx, {
        tenantId,
        branchId: goodsReceipt.branchId,
        productId: receiptLine.productId,
        batchNo: receiptLine.batchNo ?? undefined,
        expiryDate: receiptLine.expiryDate?.toISOString() ?? undefined,
        quantityDelta: -line.qtyReturnNow,
        movementType: InventoryMovementType.OUT,
        allowNegative: false,
        createdBy: user.sub,
        reason: `Purchase return ${returnNumber}`,
      });

      lineCreates.push({
        goodsReceiptLineId: line.goodsReceiptLineId,
        tenantId,
        productId: receiptLine.productId,
        inventoryMovementId: movement.id,
        qtyReturnedNow: line.qtyReturnNow,
        reasonCode: line.reasonCode,
        batchNo: receiptLine.batchNo ?? undefined,
        expiryDate: receiptLine.expiryDate ?? undefined,
        notes: line.notes,
      });
    }

    const created = await tx.purchaseReturn.create({
      data: {
        tenantId,
        goodsReceiptId: goodsReceipt.id,
        returnNumber,
        idempotencyKey: dto.idempotencyKey,
        payloadHash,
        branchId: goodsReceipt.branchId,
        supplierId: goodsReceipt.supplierId,
        notes: dto.notes,
        returnedAt: dto.returnedAt ? new Date(dto.returnedAt) : undefined,
        createdBy: user.sub,
        lines: {
          create: lineCreates,
        },
      },
      include: {
        supplier: true,
        branch: true,
        goodsReceipt: true,
        lines: {
          include: {
            product: true,
            goodsReceiptLine: true,
          },
        },
      },
    });

    return this.toReturnResponse(created);
  }

  async createProcurementAdjustment(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreateProcurementAdjustmentDto,
  ) {
    if (!user) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertBranchInTenant(tx, tenantId, dto.branchId);

      const products = await this.loadProducts(
        tx,
        tenantId,
        dto.lines.map((line) => line.productId),
      );

      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key: PROCUREMENT_ADJUSTMENT_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId,
          key: PROCUREMENT_ADJUSTMENT_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });

      const sequenceNumber = sequence.nextNumber - 1;
      const adjustmentNumber = `PADJ-${new Date().getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;
      const canOverrideNegative = user.permissions.includes(
        'inventory.override_negative',
      );

      const lineCreates: Array<{
        tenantId: string;
        productId: string;
        inventoryMovementId: string;
        quantityDelta: number;
        reasonCode?: string;
        batchNo?: string;
        expiryDate?: Date;
        notes?: string;
      }> = [];

      for (const line of dto.lines) {
        const product = products.get(line.productId);
        if (!product) {
          throw new BadRequestException('One or more products are invalid.');
        }

        if (
          product.trackingMode !== TrackingMode.NONE &&
          (!line.batchNo || !line.expiryDate)
        ) {
          throw new BadRequestException(
            `Tracked product ${line.productId} requires batchNo and expiryDate.`,
          );
        }

        const movement = await this.applyBalanceDelta(tx, {
          tenantId,
          branchId: dto.branchId,
          productId: line.productId,
          batchNo: line.batchNo,
          expiryDate: line.expiryDate,
          quantityDelta: line.quantityDelta,
          movementType: InventoryMovementType.ADJUSTMENT,
          allowNegative: canOverrideNegative,
          createdBy: user.sub,
          reason: `Procurement adjustment ${adjustmentNumber} (${line.reasonCode ?? dto.reasonCode})`,
        });

        lineCreates.push({
          tenantId,
          productId: line.productId,
          inventoryMovementId: movement.id,
          quantityDelta: line.quantityDelta,
          reasonCode: line.reasonCode,
          batchNo: line.batchNo,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
          notes: line.notes,
        });
      }

      const created = await tx.procurementAdjustment.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          adjustmentNumber,
          reasonCode: dto.reasonCode,
          sourceRefType: dto.sourceRefType,
          sourceRefId: dto.sourceRefId,
          notes: dto.notes,
          adjustedAt: dto.adjustedAt ? new Date(dto.adjustedAt) : undefined,
          createdBy: user.sub,
          lines: {
            create: lineCreates,
          },
        },
        include: {
          branch: true,
          lines: {
            include: {
              product: true,
              inventoryMovement: true,
            },
          },
        },
      });

      return {
        ...created,
        totalQuantityDelta: created.lines.reduce(
          (sum, line) => sum + line.quantityDelta,
          0,
        ),
      };
    });
  }

  private async applyBalanceDelta(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      branchId: string;
      productId: string;
      batchNo?: string;
      expiryDate?: string;
      quantityDelta: number;
      movementType: InventoryMovementType;
      allowNegative: boolean;
      createdBy: string;
      reason: string;
    },
  ) {
    const batchNoKey = args.batchNo ?? '';
    await tx.inventoryBalance.upsert({
      where: {
        tenantId_branchId_productId_batchNo: {
          tenantId: args.tenantId,
          branchId: args.branchId,
          productId: args.productId,
          batchNo: batchNoKey,
        },
      },
      update: {},
      create: {
        tenantId: args.tenantId,
        branchId: args.branchId,
        productId: args.productId,
        batchNo: batchNoKey,
        quantity: 0,
      },
    });

    if (args.quantityDelta < 0 && !args.allowNegative) {
      const guarded = await tx.inventoryBalance.updateMany({
        where: {
          tenantId: args.tenantId,
          branchId: args.branchId,
          productId: args.productId,
          batchNo: batchNoKey,
          quantity: {
            gte: Math.abs(args.quantityDelta),
          },
        },
        data: {
          quantity: {
            decrement: Math.abs(args.quantityDelta),
          },
        },
      });

      if (guarded.count === 0) {
        throw new ConflictException('Insufficient stock for this movement.');
      }
    } else {
      await tx.inventoryBalance.update({
        where: {
          tenantId_branchId_productId_batchNo: {
            tenantId: args.tenantId,
            branchId: args.branchId,
            productId: args.productId,
            batchNo: batchNoKey,
          },
        },
        data: {
          quantity:
            args.quantityDelta >= 0
              ? { increment: args.quantityDelta }
              : { decrement: Math.abs(args.quantityDelta) },
        },
      });
    }

    return tx.inventoryMovement.create({
      data: {
        tenantId: args.tenantId,
        branchId: args.branchId,
        productId: args.productId,
        batchNo: args.batchNo,
        expiryDate: args.expiryDate ? new Date(args.expiryDate) : null,
        movementType: args.movementType,
        quantity: args.quantityDelta,
        reason: args.reason,
        createdBy: args.createdBy,
      },
    });
  }

  private async assertBranchInTenant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string,
  ) {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException('Invalid branch.');
    }
  }

  private async loadProducts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productIds: string[],
  ) {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('At least one line item is required.');
    }

    const products = await tx.product.findMany({
      where: {
        tenantId,
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        trackingMode: true,
      },
    });

    if (products.length !== uniqueIds.length) {
      throw new BadRequestException('One or more products are invalid.');
    }

    return new Map(products.map((product) => [product.id, product]));
  }

  private hashPurchaseReturnPayload(dto: CreatePurchaseReturnDto): string {
    const normalized = {
      goodsReceiptId: dto.goodsReceiptId,
      returnedAt: dto.returnedAt ?? null,
      notes: dto.notes ?? null,
      lines: [...dto.lines]
        .map((line) => ({
          goodsReceiptLineId: line.goodsReceiptLineId,
          qtyReturnNow: line.qtyReturnNow,
          reasonCode: line.reasonCode ?? null,
          batchNo: line.batchNo ?? null,
          expiryDate: line.expiryDate ?? null,
          notes: line.notes ?? null,
        }))
        .sort((a, b) =>
          `${a.goodsReceiptLineId}:${a.batchNo ?? ''}:${a.expiryDate ?? ''}`.localeCompare(
            `${b.goodsReceiptLineId}:${b.batchNo ?? ''}:${b.expiryDate ?? ''}`,
          ),
        ),
    };

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeCode = (error as { code?: string }).code;
    const maybeMeta = (error as { meta?: { target?: string[] | string } }).meta;
    const target = maybeMeta?.target;

    if (maybeCode !== 'P2002') {
      return false;
    }

    if (!target) {
      return false;
    }

    if (typeof target === 'string') {
      return target.includes('tenant_id') && target.includes('idempotency_key');
    }

    return target.includes('tenant_id') && target.includes('idempotency_key');
  }

  private toReturnResponse<
    T extends { lines: Array<{ qtyReturnedNow: number }> },
  >(record: T) {
    return {
      ...record,
      totalQuantityReturned: record.lines.reduce(
        (sum, line) => sum + line.qtyReturnedNow,
        0,
      ),
    };
  }
}
