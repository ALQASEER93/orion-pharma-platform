import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: QuerySuppliersDto) {
    const where: Prisma.SupplierWhereInput = {
      tenantId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.q
        ? {
            OR: [
              { nameAr: { contains: query.q } },
              { nameEn: { contains: query.q } },
              { code: { contains: query.q } },
              { contactName: { contains: query.q } },
            ],
          }
        : {}),
    };

    return this.prisma.supplier.findMany({
      where,
      orderBy: [{ nameEn: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: {
          tenantId,
          code: dto.code,
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          contactName: dto.contactName,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          preferredPaymentTerm: dto.preferredPaymentTerm,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Supplier code already exists in tenant.');
      }
      throw error;
    }
  }

  async update(tenantId: string, supplierId: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Supplier not found.');
    }

    try {
      return await this.prisma.supplier.update({
        where: { id: supplierId },
        data: {
          ...dto,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Supplier code already exists in tenant.');
      }
      throw error;
    }
  }
}
