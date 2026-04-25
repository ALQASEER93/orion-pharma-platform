import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryLedgerEntryType,
  InventoryPostingSurface,
  InventoryStockBucket,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryLedgerEntryInput } from './dto/create-inventory-ledger-entry.input';
import { QueryInventoryLotBalancesInput } from './dto/query-inventory-lot-balances.input';

const POSITIVE_ONLY_TYPES = new Set<InventoryLedgerEntryType>([
  'STOCK_IN',
  'RELEASE',
]);
const NEGATIVE_ONLY_TYPES = new Set<InventoryLedgerEntryType>([
  'STOCK_OUT',
  'RESERVE',
  'WRITE_OFF',
]);

type BucketFieldName =
  | 'sellableQuantity'
  | 'quarantinedQuantity'
  | 'expiredQuantity';

function resolveBucketField(bucket: InventoryStockBucket): BucketFieldName {
  switch (bucket) {
    case 'SELLABLE':
      return 'sellableQuantity';
    case 'QUARANTINED':
      return 'quarantinedQuantity';
    case 'EXPIRED':
      return 'expiredQuantity';
  }
}

@Injectable()
export class InventoryLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async listLotBalances(tenantId: string, query: QueryInventoryLotBalancesInput) {
    return this.prisma.inventoryLotBalance.findMany({
      where: {
        tenantId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.productPackId ? { productPackId: query.productPackId } : {}),
        ...(query.lotBatchId ? { lotBatchId: query.lotBatchId } : {}),
      },
      orderBy: [{ branchId: 'asc' }, { productPackId: 'asc' }, { lotBatchId: 'asc' }],
    });
  }

  async createEntry(input: CreateInventoryLedgerEntryInput) {
    if (input.quantityDelta === 0) {
      throw new BadRequestException('quantityDelta cannot be zero.');
    }

    if (
      POSITIVE_ONLY_TYPES.has(input.entryType) &&
      input.quantityDelta < 0
    ) {
      throw new BadRequestException(
        `${input.entryType} requires a positive quantityDelta.`,
      );
    }

    if (
      NEGATIVE_ONLY_TYPES.has(input.entryType) &&
      input.quantityDelta > 0
    ) {
      throw new BadRequestException(
        `${input.entryType} requires a negative quantityDelta.`,
      );
    }

    const postingSurface = input.postingSurface ?? 'BRANCH';
    const stockBucket = input.stockBucket ?? 'SELLABLE';
    const referenceType = input.referenceType ?? 'FOUNDATION';
    const registerId = input.registerId ?? null;

    if (postingSurface === InventoryPostingSurface.REGISTER && !registerId) {
      throw new BadRequestException(
        'registerId is required when postingSurface is REGISTER.',
      );
    }

    if (postingSurface === InventoryPostingSurface.BRANCH && registerId) {
      throw new BadRequestException(
        'registerId must be null when postingSurface is BRANCH.',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, tenantId: input.tenantId },
      select: { id: true, legalEntityId: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found in tenant.');
    }

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
        'Lot batch is not linked to the provided product pack.',
      );
    }

    let registerLegalEntityId: string | null = null;
    if (registerId) {
      const register = await this.prisma.register.findFirst({
        where: { id: registerId, tenantId: input.tenantId },
        select: { id: true, branchId: true, legalEntityId: true },
      });
      if (!register) {
        throw new NotFoundException('Register not found in tenant.');
      }

      if (register.branchId !== input.branchId) {
        throw new ConflictException(
          'Register must belong to the same branch as the ledger entry.',
        );
      }

      if (branch.legalEntityId && register.legalEntityId !== branch.legalEntityId) {
        throw new ConflictException(
          'Register legal entity does not match branch legal entity.',
        );
      }
      registerLegalEntityId = register.legalEntityId;
    }

    const quantityDelta = Math.trunc(input.quantityDelta);
    const absoluteQuantity = Math.abs(quantityDelta);
    const amountTotal =
      input.amountTotal ??
      (input.unitCost != null ? absoluteQuantity * input.unitCost : null);
    const bucketField = resolveBucketField(stockBucket);
    const legalEntityId = registerLegalEntityId ?? branch.legalEntityId ?? null;

    return this.prisma.$transaction(async (tx) => {
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
            'Insufficient on-hand quantity for the requested lot/bucket movement.',
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
          legalEntityId,
          branchId: input.branchId,
          registerId,
          productPackId: input.productPackId,
          lotBatchId: input.lotBatchId,
          entryType: input.entryType,
          postingSurface,
          referenceType,
          referenceId: input.referenceId ?? null,
          referenceLineId: input.referenceLineId ?? null,
          reasonCode: input.reasonCode ?? null,
          stockBucket,
          quantityDelta,
          unitCost: input.unitCost ?? null,
          amountTotal,
          occurredAt: input.occurredAt ?? new Date(),
          createdBy: input.createdBy ?? null,
        },
      });
    });
  }
}
