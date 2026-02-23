import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { assertNonNegativeStock } from './stock-math';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getStockOnHand(tenantId: string, query: QueryStockDto) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
      },
      select: {
        branchId: true,
        productId: true,
        batchNo: true,
        quantity: true,
      },
    });

    const map = new Map<
      string,
      {
        branchId: string;
        productId: string;
        batchNo: string | null;
        quantity: number;
      }
    >();
    for (const movement of movements) {
      const key = `${movement.branchId}:${movement.productId}:${movement.batchNo ?? ''}`;
      const current = map.get(key);
      if (current) {
        current.quantity += movement.quantity;
      } else {
        map.set(key, {
          branchId: movement.branchId,
          productId: movement.productId,
          batchNo: movement.batchNo,
          quantity: movement.quantity,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      `${a.branchId}:${a.productId}:${a.batchNo ?? ''}`.localeCompare(
        `${b.branchId}:${b.productId}:${b.batchNo ?? ''}`,
      ),
    );
  }

  async addMovement(
    tenantId: string,
    user: JwtUserPayload | undefined,
    dto: CreateInventoryMovementDto,
  ) {
    if (!user) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId },
      select: { id: true, trackingMode: true },
    });
    if (!product) {
      throw new BadRequestException('Invalid product.');
    }

    if (dto.movementType === InventoryMovementType.OUT && dto.quantity > 0) {
      throw new BadRequestException('OUT movement must use negative quantity.');
    }

    if (product.trackingMode !== 'NONE' && (!dto.batchNo || !dto.expiryDate)) {
      throw new BadRequestException(
        'Batch number and expiry date are required for tracked products.',
      );
    }

    const currentStock = await this.prisma.inventoryMovement.aggregate({
      where: {
        tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        batchNo: dto.batchNo ?? null,
      },
      _sum: {
        quantity: true,
      },
    });

    const existingQty = currentStock._sum.quantity ?? 0;
    const canOverrideNegative = user.permissions.includes(
      'inventory.override_negative',
    );

    assertNonNegativeStock(existingQty, dto.quantity, canOverrideNegative);

    return this.prisma.inventoryMovement.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        batchNo: dto.batchNo,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        movementType: dto.movementType,
        quantity: dto.quantity,
        reason: dto.reason,
        createdBy: user.sub,
      },
    });
  }
}
