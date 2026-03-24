import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  PurchaseOrderStatus,
  TrackingMode,
} from '@prisma/client';
import { createHash } from 'crypto';
import { InventoryValuationService } from '../inventory/inventory-valuation.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { QueryGoodsReceiptsDto } from './dto/query-goods-receipts.dto';

const GOODS_RECEIPT_SEQUENCE_KEY = 'GOODS_RECEIPT';

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryValuationService: InventoryValuationService,
  ) {}

  async list(tenantId: string, query: QueryGoodsReceiptsDto) {
    const where: Prisma.GoodsReceiptWhereInput = {
      tenantId,
      ...(query.purchaseOrderId
        ? { purchaseOrderId: query.purchaseOrderId }
        : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.receivedFrom || query.receivedTo
        ? {
            receivedAt: {
              ...(query.receivedFrom
                ? { gte: new Date(query.receivedFrom) }
                : {}),
              ...(query.receivedTo ? { lte: new Date(query.receivedTo) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { grnNumber: { contains: query.q } },
              { purchaseOrder: { poNumber: { contains: query.q } } },
            ],
          }
        : {}),
    };

    const records = await this.prisma.goodsReceipt.findMany({
      where,
      orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: true,
        branch: true,
        purchaseOrder: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    return records.map((record) => this.toResponse(record));
  }

  async create(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreateGoodsReceiptDto,
  ) {
    if (!user) {
      throw new BadRequestException('Authenticated user context is required.');
    }

    const payloadHash = this.hashPayload(dto);

    try {
      return await this.prisma.$transaction((tx) =>
        this.createInTransaction(tx, tenantId, user, dto, payloadHash),
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.prisma.goodsReceipt.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: {
          supplier: true,
          branch: true,
          purchaseOrder: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!existing) {
        throw error;
      }

      if (existing.payloadHash !== payloadHash) {
        throw new ConflictException(
          'Idempotency key already used with different payload.',
        );
      }

      return this.toResponse(existing);
    }
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    user: JwtUserPayload,
    dto: CreateGoodsReceiptDto,
    payloadHash: string,
  ) {
    const replay = await tx.goodsReceipt.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: {
        supplier: true,
        branch: true,
        purchaseOrder: true,
        lines: {
          include: {
            product: true,
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

      return this.toResponse(replay);
    }

    const purchaseOrder = await tx.purchaseOrder.findFirst({
      where: {
        id: dto.purchaseOrderId,
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

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found.');
    }

    if (
      purchaseOrder.status !== PurchaseOrderStatus.SUBMITTED &&
      purchaseOrder.status !== PurchaseOrderStatus.APPROVED
    ) {
      throw new ConflictException('Purchase order is not receivable.');
    }

    const poLineMap = new Map(
      purchaseOrder.lines.map((line) => [
        line.id,
        {
          id: line.id,
          productId: line.productId,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          receivedQuantity: line.receivedQuantity,
          trackingMode: line.product.trackingMode,
        },
      ]),
    );

    const aggregateQty = new Map<string, number>();

    for (const line of dto.lines) {
      const poLine = poLineMap.get(line.purchaseOrderLineId);
      if (!poLine) {
        throw new NotFoundException(
          `Purchase order line not found: ${line.purchaseOrderLineId}`,
        );
      }

      if (line.qtyReceivedNow <= 0) {
        throw new BadRequestException('qtyReceivedNow must be greater than 0.');
      }

      if (
        poLine.trackingMode !== TrackingMode.NONE &&
        (!line.batchNo || !line.expiryDate)
      ) {
        throw new BadRequestException(
          `Tracked product on line ${line.purchaseOrderLineId} requires batchNo and expiryDate.`,
        );
      }

      aggregateQty.set(
        line.purchaseOrderLineId,
        (aggregateQty.get(line.purchaseOrderLineId) ?? 0) + line.qtyReceivedNow,
      );
    }

    for (const [lineId, qty] of aggregateQty.entries()) {
      const guarded = await tx.purchaseOrderLine.updateMany({
        where: {
          id: lineId,
          tenantId,
          purchaseOrderId: purchaseOrder.id,
          receivedQuantity: {
            lte: (poLineMap.get(lineId)?.quantity ?? 0) - qty,
          },
        },
        data: {
          receivedQuantity: {
            increment: qty,
          },
        },
      });

      if (guarded.count === 0) {
        throw new ConflictException(
          `Over-receipt conflict on purchase order line ${lineId}.`,
        );
      }
    }

    const sequence = await tx.documentSequence.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: GOODS_RECEIPT_SEQUENCE_KEY,
        },
      },
      create: {
        tenantId,
        key: GOODS_RECEIPT_SEQUENCE_KEY,
        nextNumber: 2,
      },
      update: {
        nextNumber: {
          increment: 1,
        },
      },
    });

    const sequenceNumber = sequence.nextNumber - 1;
    const grnNumber = `GRN-${new Date().getUTCFullYear()}-${sequenceNumber
      .toString()
      .padStart(6, '0')}`;

    const movementResults: Array<{
      purchaseOrderLineId: string;
      productId: string;
      movementId: string;
      qtyReceivedNow: number;
      batchNo?: string;
      expiryDate?: Date;
      notes?: string;
    }> = [];

    for (const line of dto.lines) {
      const poLine = poLineMap.get(line.purchaseOrderLineId);
      if (!poLine) {
        throw new NotFoundException(
          `Purchase order line not found: ${line.purchaseOrderLineId}`,
        );
      }

      const movement = await this.applyInventoryIncrement(tx, {
        tenantId,
        branchId: purchaseOrder.branchId,
        productId: poLine.productId,
        qtyReceivedNow: line.qtyReceivedNow,
        batchNo: line.batchNo,
        expiryDate: line.expiryDate,
        receivedAt: dto.receivedAt,
        createdBy: user.sub,
        reason: `Goods receipt ${grnNumber}`,
        unitCost: poLine.unitPrice,
      });

      movementResults.push({
        purchaseOrderLineId: line.purchaseOrderLineId,
        productId: poLine.productId,
        movementId: movement.id,
        qtyReceivedNow: line.qtyReceivedNow,
        batchNo: line.batchNo,
        expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
        notes: line.notes,
      });
    }

    const created = await tx.goodsReceipt.create({
      data: {
        tenantId,
        branchId: purchaseOrder.branchId,
        supplierId: purchaseOrder.supplierId,
        purchaseOrderId: purchaseOrder.id,
        grnNumber,
        idempotencyKey: dto.idempotencyKey,
        payloadHash,
        notes: dto.notes,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
        createdBy: user.sub,
        lines: {
          create: movementResults.map((line) => ({
            tenantId,
            purchaseOrderLineId: line.purchaseOrderLineId,
            productId: line.productId,
            inventoryMovementId: line.movementId,
            qtyReceivedNow: line.qtyReceivedNow,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
            notes: line.notes,
          })),
        },
      },
      include: {
        supplier: true,
        branch: true,
        purchaseOrder: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    const latestLines = await tx.purchaseOrderLine.findMany({
      where: {
        tenantId,
        purchaseOrderId: purchaseOrder.id,
      },
      select: {
        quantity: true,
        receivedQuantity: true,
      },
    });

    if (latestLines.every((line) => line.receivedQuantity >= line.quantity)) {
      await tx.purchaseOrder.update({
        where: {
          id: purchaseOrder.id,
        },
        data: {
          status: PurchaseOrderStatus.CLOSED,
        },
      });
    }

    return this.toResponse(created);
  }

  private async applyInventoryIncrement(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      branchId: string;
      productId: string;
      qtyReceivedNow: number;
      batchNo?: string;
      expiryDate?: string;
      receivedAt?: string;
      createdBy: string;
      reason: string;
      unitCost?: number;
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
        quantity: {
          increment: args.qtyReceivedNow,
        },
      },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId: args.tenantId,
        branchId: args.branchId,
        productId: args.productId,
        batchNo: args.batchNo,
        expiryDate: args.expiryDate ? new Date(args.expiryDate) : null,
        businessDate: args.receivedAt ? new Date(args.receivedAt) : new Date(),
        movementType: InventoryMovementType.IN,
        quantity: args.qtyReceivedNow,
        unitCost: args.unitCost,
        costTotal:
          args.unitCost !== undefined
            ? args.qtyReceivedNow * args.unitCost
            : null,
        reason: args.reason,
        createdBy: args.createdBy,
      },
    });

    await this.inventoryValuationService.applyMovement(tx, {
      tenantId: args.tenantId,
      inventoryMovementId: movement.id,
      branchId: args.branchId,
      productId: args.productId,
      quantityDelta: args.qtyReceivedNow,
      unitCost: args.unitCost,
    });

    return movement;
  }

  private hashPayload(dto: CreateGoodsReceiptDto): string {
    const normalized = {
      purchaseOrderId: dto.purchaseOrderId,
      receivedAt: dto.receivedAt ?? null,
      notes: dto.notes ?? null,
      lines: [...dto.lines]
        .map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          qtyReceivedNow: line.qtyReceivedNow,
          batchNo: line.batchNo ?? null,
          expiryDate: line.expiryDate ?? null,
          notes: line.notes ?? null,
        }))
        .sort((a, b) =>
          `${a.purchaseOrderLineId}:${a.batchNo ?? ''}:${a.expiryDate ?? ''}`.localeCompare(
            `${b.purchaseOrderLineId}:${b.batchNo ?? ''}:${b.expiryDate ?? ''}`,
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

  private toResponse<T extends { lines: Array<{ qtyReceivedNow: number }> }>(
    record: T,
  ) {
    const totalReceivedQuantity = record.lines.reduce(
      (sum, line) => sum + line.qtyReceivedNow,
      0,
    );

    return {
      ...record,
      totalReceivedQuantity,
    };
  }
}
