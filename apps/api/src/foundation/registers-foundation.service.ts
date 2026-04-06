import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegisterInput } from './dto/create-register.input';

@Injectable()
export class RegistersFoundationService {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tenantId: string) {
    return this.prisma.register.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }],
    });
  }

  async create(input: CreateRegisterInput) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, tenantId: input.tenantId },
      select: { id: true, legalEntityId: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found in tenant.');
    }

    const legalEntity = await this.prisma.legalEntity.findFirst({
      where: { id: input.legalEntityId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!legalEntity) {
      throw new NotFoundException('Legal entity not found in tenant.');
    }

    if (branch.legalEntityId && branch.legalEntityId !== input.legalEntityId) {
      throw new ConflictException(
        'Branch is already bound to a different legal entity.',
      );
    }

    if (!branch.legalEntityId) {
      await this.prisma.branch.update({
        where: { id: branch.id },
        data: { legalEntityId: input.legalEntityId },
      });
    }

    try {
      return await this.prisma.register.create({
        data: {
          tenantId: input.tenantId,
          legalEntityId: input.legalEntityId,
          branchId: input.branchId,
          code: input.code.trim(),
          nameAr: input.nameAr.trim(),
          nameEn: input.nameEn.trim(),
          isActive: input.isActive ?? true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Register code already exists in branch.');
      }
      throw error;
    }
  }
}

