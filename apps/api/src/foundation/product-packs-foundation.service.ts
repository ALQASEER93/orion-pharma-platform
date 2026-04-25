import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductPackInput } from './dto/create-product-pack.input';

@Injectable()
export class ProductPacksFoundationService {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tenantId: string) {
    return this.prisma.productPack.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }],
    });
  }

  async create(input: CreateProductPackInput) {
    if ((input.unitsPerPack ?? 1) <= 0) {
      throw new ConflictException('unitsPerPack must be greater than zero.');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found in tenant.');
    }

    try {
      return await this.prisma.productPack.create({
        data: {
          tenantId: input.tenantId,
          productId: input.productId,
          code: input.code.trim(),
          barcode: input.barcode ?? null,
          unitsPerPack: input.unitsPerPack ?? 1,
          status: input.status ?? 'DRAFT',
          sellability: input.sellability ?? 'UNKNOWN',
          isDefault: input.isDefault ?? false,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Product pack code already exists in tenant.');
      }
      throw error;
    }
  }
}

