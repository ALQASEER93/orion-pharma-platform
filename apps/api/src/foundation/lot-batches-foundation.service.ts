import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLotBatchInput } from './dto/create-lot-batch.input';

@Injectable()
export class LotBatchesFoundationService {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tenantId: string) {
    return this.prisma.lotBatch.findMany({
      where: { tenantId },
      orderBy: [{ receivedOn: 'desc' }],
    });
  }

  async create(input: CreateLotBatchInput) {
    const productPack = await this.prisma.productPack.findFirst({
      where: { id: input.productPackId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!productPack) {
      throw new NotFoundException('Product pack not found in tenant.');
    }

    const receivedOn = input.receivedOn ?? new Date();
    if (input.expiryDate && input.expiryDate < receivedOn) {
      throw new ConflictException('expiryDate cannot be before receivedOn.');
    }

    try {
      return await this.prisma.lotBatch.create({
        data: {
          tenantId: input.tenantId,
          productPackId: input.productPackId,
          batchNo: input.batchNo.trim(),
          expiryDate: input.expiryDate ?? null,
          receivedOn,
          status: input.status ?? 'RECEIVED',
          isSellable: input.isSellable ?? true,
          quarantinedAt: input.quarantinedAt ?? null,
          quarantineReason: input.quarantineReason ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Batch number already exists for product pack in tenant.',
        );
      }
      throw error;
    }
  }
}
