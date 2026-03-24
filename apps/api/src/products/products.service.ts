import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TrackingMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryProductsDto) {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(query.trackingMode ? { trackingMode: query.trackingMode } : {}),
      ...(query.medicationAccessMode
        ? { medicationAccessMode: query.medicationAccessMode }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.q
        ? {
            OR: [
              { barcode: { contains: query.q } },
              { nameAr: { contains: query.q } },
              { nameEn: { contains: query.q } },
              { tradeNameAr: { contains: query.q } },
              { tradeNameEn: { contains: query.q } },
              { genericNameAr: { contains: query.q } },
              { genericNameEn: { contains: query.q } },
              { categoryAr: { contains: query.q } },
              { categoryEn: { contains: query.q } },
              { taxProfileCode: { contains: query.q } },
            ],
          }
        : {}),
    };

    const records = await this.prisma.product.findMany({
      where,
      take: query.limit ?? 50,
      orderBy: [{ nameEn: 'asc' }, { barcode: 'asc' }],
      include: {
        therapeuticClass: true,
        dosageForm: true,
        storageCondition: true,
        regulatoryType: true,
      },
    });

    const normalized = query.q?.trim().toLowerCase();
    const sorted = normalized
      ? [...records].sort((left, right) => {
          const rankDelta =
            this.getSearchRank(left, normalized) -
            this.getSearchRank(right, normalized);
          if (rankDelta !== 0) {
            return rankDelta;
          }

          return `${left.nameEn}:${left.barcode}`.localeCompare(
            `${right.nameEn}:${right.barcode}`,
          );
        })
      : records;

    if (
      !(query.includeAvailability || query.branchId || query.mode === 'pos')
    ) {
      return sorted;
    }

    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        tenantId,
        productId: { in: sorted.map((record) => record.id) },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      select: {
        branchId: true,
        productId: true,
        batchNo: true,
        quantity: true,
      },
    });

    const availabilityByProduct = new Map<
      string,
      {
        quantityOnHand: number;
        batchCount: number;
        branchIds: Set<string>;
      }
    >();

    for (const balance of balances) {
      const current = availabilityByProduct.get(balance.productId) ?? {
        quantityOnHand: 0,
        batchCount: 0,
        branchIds: new Set<string>(),
      };
      current.quantityOnHand += balance.quantity;
      if (balance.quantity > 0) {
        current.batchCount += 1;
      }
      current.branchIds.add(balance.branchId);
      availabilityByProduct.set(balance.productId, current);
    }

    return sorted.map((product) => {
      const availability = availabilityByProduct.get(product.id) ?? {
        quantityOnHand: 0,
        batchCount: 0,
        branchIds: new Set<string>(),
      };

      return {
        ...product,
        ...(normalized
          ? {
              search: {
                query: query.q,
                exactBarcodeMatch: product.barcode.toLowerCase() === normalized,
                matchedFields: this.resolveMatchedFields(product, normalized),
              },
            }
          : {}),
        availability: {
          branchScope: query.branchId ? 'SINGLE_BRANCH' : 'TENANT',
          branchId: query.branchId ?? null,
          quantityOnHand: availability.quantityOnHand,
          batchCount: availability.batchCount,
          branchesWithStock: availability.branchIds.size,
          status: availability.quantityOnHand > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
          isAvailable: availability.quantityOnHand > 0,
        },
      };
    });
  }

  async create(tenantId: string, dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          tenantId,
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          tradeNameAr: dto.tradeNameAr,
          tradeNameEn: dto.tradeNameEn,
          genericNameAr: dto.genericNameAr,
          genericNameEn: dto.genericNameEn,
          categoryAr: dto.categoryAr,
          categoryEn: dto.categoryEn,
          barcode: dto.barcode,
          strength: dto.strength,
          packSize: dto.packSize,
          unitOfMeasure: dto.unitOfMeasure,
          taxProfileCode: dto.taxProfileCode,
          medicationAccessMode: dto.medicationAccessMode,
          isActive: dto.isActive ?? true,
          trackingMode: dto.trackingMode ?? TrackingMode.NONE,
          therapeuticClassId: dto.therapeuticClassId,
          dosageFormId: dto.dosageFormId,
          storageConditionId: dto.storageConditionId,
          regulatoryTypeId: dto.regulatoryTypeId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Product barcode already exists in tenant.',
        );
      }
      throw error;
    }
  }

  async update(tenantId: string, productId: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Product not found.');
    }

    try {
      return await this.prisma.product.update({
        where: { id: productId },
        data: {
          ...dto,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Product barcode already exists in tenant.',
        );
      }
      throw error;
    }
  }

  private resolveMatchedFields(
    product: {
      barcode: string;
      nameAr: string;
      nameEn: string;
      tradeNameAr: string | null;
      tradeNameEn: string | null;
      genericNameAr: string | null;
      genericNameEn: string | null;
      categoryAr: string | null;
      categoryEn: string | null;
    },
    query: string,
  ) {
    const fields: string[] = [];
    const matchers: Array<[string, string | null | undefined]> = [
      ['barcode', product.barcode],
      ['nameAr', product.nameAr],
      ['nameEn', product.nameEn],
      ['tradeNameAr', product.tradeNameAr],
      ['tradeNameEn', product.tradeNameEn],
      ['genericNameAr', product.genericNameAr],
      ['genericNameEn', product.genericNameEn],
      ['categoryAr', product.categoryAr],
      ['categoryEn', product.categoryEn],
    ];

    for (const [field, value] of matchers) {
      if (value?.toLowerCase().includes(query)) {
        fields.push(field);
      }
    }

    return fields;
  }

  private getSearchRank(
    product: {
      barcode: string;
      nameAr: string;
      nameEn: string;
      tradeNameAr: string | null;
      tradeNameEn: string | null;
      genericNameAr: string | null;
      genericNameEn: string | null;
    },
    query: string,
  ) {
    const exactFields = [
      product.barcode,
      product.nameAr,
      product.nameEn,
      product.tradeNameAr,
      product.tradeNameEn,
      product.genericNameAr,
      product.genericNameEn,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    if (product.barcode.toLowerCase() === query) {
      return 0;
    }
    if (product.barcode.toLowerCase().startsWith(query)) {
      return 1;
    }
    if (exactFields.some((value) => value === query)) {
      return 2;
    }
    if (exactFields.some((value) => value.startsWith(query))) {
      return 3;
    }
    return 4;
  }
}
