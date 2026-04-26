import { ConflictException, NotFoundException } from '@nestjs/common';
import { LegalEntitiesFoundationService } from './legal-entities-foundation.service';
import { RegistersFoundationService } from './registers-foundation.service';
import { ProductPacksFoundationService } from './product-packs-foundation.service';
import { LotBatchesFoundationService } from './lot-batches-foundation.service';

function createPrismaMock() {
  return {
    legalEntity: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    register: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    productPack: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    lotBatch: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('Foundation services', () => {
  it('rejects register creation when branch is bound to another legal entity', async () => {
    const prisma = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      legalEntityId: 'legal-entity-existing',
    });
    prisma.legalEntity.findFirst.mockResolvedValue({
      id: 'legal-entity-target',
    });

    const service = new RegistersFoundationService(prisma as never);

    await expect(
      service.create({
        tenantId: 'tenant-1',
        legalEntityId: 'legal-entity-target',
        branchId: 'branch-1',
        code: 'REG-01',
        nameAr: 'صندوق 1',
        nameEn: 'Register 1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects lot batch when expiry is before received date', async () => {
    const prisma = createPrismaMock();
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });

    const service = new LotBatchesFoundationService(prisma as never);

    await expect(
      service.create({
        tenantId: 'tenant-1',
        productPackId: 'pack-1',
        batchNo: 'LOT-001',
        receivedOn: new Date('2026-01-05T00:00:00.000Z'),
        expiryDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects product pack when product is missing in tenant', async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue(null);

    const service = new ProductPacksFoundationService(prisma as never);

    await expect(
      service.create({
        tenantId: 'tenant-1',
        productId: 'product-1',
        code: 'PACK-01',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('defaults legal entity active state to true', async () => {
    const prisma = createPrismaMock();
    prisma.legalEntity.create.mockResolvedValue({ id: 'legal-1' });

    const service = new LegalEntitiesFoundationService(prisma as never);

    await service.create({
      tenantId: 'tenant-1',
      code: 'LE-01',
      nameAr: 'الكيان القانوني',
      nameEn: 'Legal Entity',
    });

    expect(prisma.legalEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: true,
        }),
      }),
    );
  });
});
