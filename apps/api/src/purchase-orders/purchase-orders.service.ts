import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';

const PURCHASE_ORDER_SEQUENCE_KEY = 'PURCHASE_ORDER';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePurchaseOrderDto) {
    await this.assertBranchInTenant(tenantId, dto.branchId);
    await this.assertSupplierInTenant(tenantId, dto.supplierId);
    await this.assertProductsInTenant(
      tenantId,
      dto.lines.map((line) => line.productId),
    );

    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.documentSequence.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key: PURCHASE_ORDER_SEQUENCE_KEY,
          },
        },
        create: {
          tenantId,
          key: PURCHASE_ORDER_SEQUENCE_KEY,
          nextNumber: 2,
        },
        update: {
          nextNumber: {
            increment: 1,
          },
        },
      });

      const sequenceNumber = sequence.nextNumber - 1;
      const poNumber = `PO-${new Date().getUTCFullYear()}-${sequenceNumber
        .toString()
        .padStart(6, '0')}`;

      const created = await tx.purchaseOrder.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          poNumber,
          status: PurchaseOrderStatus.DRAFT,
          notes: dto.notes,
          lines: {
            create: dto.lines.map((line) => ({
              tenantId,
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: this.roundMoney(line.quantity * line.unitPrice),
              notes: line.notes,
            })),
          },
        },
        include: {
          branch: true,
          supplier: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
      });

      return this.toResponse(created);
    });
  }

  async list(tenantId: string, query: QueryPurchaseOrdersDto) {
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.q
        ? {
            OR: [
              { poNumber: { contains: query.q } },
              { supplier: { nameEn: { contains: query.q } } },
              { supplier: { nameAr: { contains: query.q } } },
            ],
          }
        : {}),
    };

    const records = await this.prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ orderedAt: 'desc' }],
      include: {
        supplier: true,
        branch: true,
        lines: true,
      },
    });

    return records.map((record) => this.toResponse(record));
  }

  async detail(tenantId: string, purchaseOrderId: string) {
    const record = await this.prisma.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        tenantId,
      },
      include: {
        supplier: true,
        branch: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Purchase order not found.');
    }

    return this.toResponse(record);
  }

  private async assertBranchInTenant(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException('Invalid branch.');
    }
  }

  private async assertSupplierInTenant(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      throw new BadRequestException('Invalid supplier.');
    }
  }

  private async assertProductsInTenant(tenantId: string, productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('At least one line item is required.');
    }

    const count = await this.prisma.product.count({
      where: {
        tenantId,
        id: { in: uniqueIds },
      },
    });

    if (count !== uniqueIds.length) {
      throw new BadRequestException('One or more products are invalid.');
    }
  }

  private toResponse<
    T extends { lines: Array<{ quantity: number; lineTotal: number }> },
  >(record: T) {
    const totalQuantity = record.lines.reduce(
      (sum, line) => sum + line.quantity,
      0,
    );
    const totalAmount = this.roundMoney(
      record.lines.reduce((sum, line) => sum + line.lineTotal, 0),
    );

    return {
      ...record,
      totalQuantity,
      totalAmount,
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
