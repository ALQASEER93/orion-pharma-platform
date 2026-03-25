import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLegalEntityInput } from './dto/create-legal-entity.input';

@Injectable()
export class LegalEntitiesFoundationService {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tenantId: string) {
    return this.prisma.legalEntity.findMany({
      where: { tenantId },
      orderBy: [{ nameEn: 'asc' }],
    });
  }

  async create(input: CreateLegalEntityInput) {
    try {
      return await this.prisma.legalEntity.create({
        data: {
          tenantId: input.tenantId,
          code: input.code.trim(),
          nameAr: input.nameAr.trim(),
          nameEn: input.nameEn.trim(),
          registrationNumber: input.registrationNumber ?? null,
          taxNumber: input.taxNumber ?? null,
          isActive: input.isActive ?? true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Legal entity code already exists in tenant.');
      }
      throw error;
    }
  }
}

