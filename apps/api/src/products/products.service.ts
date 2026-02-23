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
      ...(query.q
        ? {
            OR: [
              { nameAr: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.product.findMany({
      where,
      orderBy: [{ nameEn: 'asc' }],
      include: {
        therapeuticClass: true,
        dosageForm: true,
        storageCondition: true,
        regulatoryType: true,
      },
    });
  }

  async create(tenantId: string, dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          tenantId,
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          barcode: dto.barcode,
          strength: dto.strength,
          packSize: dto.packSize,
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
}
