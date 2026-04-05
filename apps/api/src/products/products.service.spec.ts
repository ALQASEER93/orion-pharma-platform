import { ConflictException } from '@nestjs/common';
import { Prisma, TrackingMode } from '@prisma/client';
import { ProductsService } from './products.service';

function createPrismaMock() {
  return {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryLotBalance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };
}

function createUniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

describe('ProductsService', () => {
  it('builds trade-name search clauses for trade search mode', async () => {
    const prisma = createPrismaMock();
    const service = new ProductsService(prisma as never);

    await service.list('tenant-1', {
      q: 'panadol',
      searchMode: 'trade',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          OR: [
            { tradeNameEn: { contains: 'panadol' } },
            { tradeNameAr: { contains: 'panadol' } },
            { nameEn: { contains: 'panadol' } },
            { nameAr: { contains: 'panadol' } },
            { barcode: { contains: 'panadol' } },
          ],
        },
      }),
    );
  });

  it('builds generic-name search clauses for generic search mode', async () => {
    const prisma = createPrismaMock();
    const service = new ProductsService(prisma as never);

    await service.list('tenant-1', {
      q: 'paracetamol',
      searchMode: 'generic',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          OR: [
            { genericNameEn: { contains: 'paracetamol' } },
            { genericNameAr: { contains: 'paracetamol' } },
            { nameEn: { contains: 'paracetamol' } },
            { nameAr: { contains: 'paracetamol' } },
          ],
        },
      }),
    );
  });

  it('builds supplier search clauses for supplier search mode', async () => {
    const prisma = createPrismaMock();
    const service = new ProductsService(prisma as never);

    await service.list('tenant-1', {
      q: 'first medical supplier',
      searchMode: 'supplier',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          OR: [
            { supplier: { is: { nameEn: { contains: 'first medical supplier' } } } },
            { supplier: { is: { nameAr: { contains: 'first medical supplier' } } } },
            { supplier: { is: { code: { contains: 'first medical supplier' } } } },
          ],
        },
      }),
    );
  });

  it('builds category and dosage-form search clauses for category search mode', async () => {
    const prisma = createPrismaMock();
    const service = new ProductsService(prisma as never);

    await service.list('tenant-1', {
      q: 'tablet',
      searchMode: 'category',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          OR: [
            { categoryEn: { contains: 'tablet' } },
            { categoryAr: { contains: 'tablet' } },
            { dosageForm: { is: { nameEn: { contains: 'tablet' } } } },
            { dosageForm: { is: { nameAr: { contains: 'tablet' } } } },
          ],
        },
      }),
    );
  });

  it('builds barcode-only search clauses for barcode search mode', async () => {
    const prisma = createPrismaMock();
    const service = new ProductsService(prisma as never);

    await service.list('tenant-1', {
      q: 'ORION-AMOX-500',
      searchMode: 'barcode',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          OR: [{ barcode: { contains: 'ORION-AMOX-500' } }],
        },
      }),
    );
  });

  it('maps duplicate product barcode conflicts to a specific operator message', async () => {
    const prisma = createPrismaMock();
    prisma.product.create.mockRejectedValue(
      createUniqueError(['tenantId', 'barcode']),
    );
    const service = new ProductsService(prisma as never);

    await expect(
      service.create('tenant-1', {
        nameEn: 'Panadol',
        nameAr: 'بانادول',
        barcode: 'PAN-1',
        strength: '500mg',
        packSize: '24 tablets',
        trackingMode: TrackingMode.NONE,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'Product barcode already exists in tenant.',
      }),
    );
  });

  it('maps duplicate pack code conflicts during maintenance save', async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockRejectedValue(createUniqueError(['tenantId', 'code']));
    const service = new ProductsService(prisma as never);

    await expect(
      service.saveMaintenanceRecord(
        'tenant-1',
        { branchId: 'branch-1' } as never,
        'user-1',
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'Pack code already exists in tenant.',
      }),
    );
  });

  it('maps duplicate lot batch conflicts during maintenance save', async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockRejectedValue(
      createUniqueError(['tenantId', 'productPackId', 'batchNo']),
    );
    const service = new ProductsService(prisma as never);

    await expect(
      service.saveMaintenanceRecord(
        'tenant-1',
        { branchId: 'branch-1' } as never,
        'user-1',
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'Batch number already exists for the selected product pack.',
      }),
    );
  });

  it('rethrows non-prisma conflicts unchanged', async () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockRejectedValue(new ConflictException('manual'));
    const service = new ProductsService(prisma as never);

    await expect(
      service.saveMaintenanceRecord(
        'tenant-1',
        { branchId: 'branch-1' } as never,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
