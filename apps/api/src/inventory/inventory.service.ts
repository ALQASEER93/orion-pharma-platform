import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUserPayload } from '../common/types/request-with-context.type';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { InventoryValuationService } from './inventory-valuation.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryValuationService: InventoryValuationService,
  ) {}

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

    const canOverrideNegative = user.permissions.includes(
      'inventory.override_negative',
    );
    const batchNoKey = dto.batchNo ?? '';

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryBalance.upsert({
        where: {
          tenantId_branchId_productId_batchNo: {
            tenantId,
            branchId: dto.branchId,
            productId: dto.productId,
            batchNo: batchNoKey,
          },
        },
        update: {},
        create: {
          tenantId,
          branchId: dto.branchId,
          productId: dto.productId,
          batchNo: batchNoKey,
          quantity: 0,
        },
      });

      if (dto.quantity < 0 && !canOverrideNegative) {
        const guardResult = await tx.inventoryBalance.updateMany({
          where: {
            tenantId,
            branchId: dto.branchId,
            productId: dto.productId,
            batchNo: batchNoKey,
            quantity: {
              gte: Math.abs(dto.quantity),
            },
          },
          data: {
            quantity: {
              decrement: Math.abs(dto.quantity),
            },
          },
        });

        if (guardResult.count === 0) {
          throw new ConflictException('Insufficient stock for this movement.');
        }
      } else {
        await tx.inventoryBalance.update({
          where: {
            tenantId_branchId_productId_batchNo: {
              tenantId,
              branchId: dto.branchId,
              productId: dto.productId,
              batchNo: batchNoKey,
            },
          },
          data: {
            quantity:
              dto.quantity >= 0
                ? { increment: dto.quantity }
                : { decrement: Math.abs(dto.quantity) },
          },
        });
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          productId: dto.productId,
          batchNo: dto.batchNo,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          businessDate: dto.businessDate
            ? new Date(dto.businessDate)
            : new Date(),
          movementType: dto.movementType,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          costTotal:
            dto.unitCost !== undefined
              ? Math.abs(dto.quantity) * dto.unitCost
              : null,
          reason: dto.reason,
          createdBy: user.sub,
        },
      });

      await this.inventoryValuationService.applyMovement(tx, {
        tenantId,
        inventoryMovementId: movement.id,
        branchId: dto.branchId,
        productId: dto.productId,
        quantityDelta: dto.quantity,
        unitCost: dto.unitCost,
      });

      return movement;
    });
  }
}
