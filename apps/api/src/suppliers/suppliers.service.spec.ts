import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  const prisma = {
    supplier: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: SuppliersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SuppliersService(prisma as never);
  });

  it('lists suppliers by tenant and query', async () => {
    prisma.supplier.findMany.mockResolvedValueOnce([
      { id: 'sup-1', tenantId: 'tenant-1', code: 'SUP-001' },
    ]);

    const result = await service.list('tenant-1', { q: 'SUP', isActive: true });

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          isActive: true,
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('creates supplier with tenant isolation', async () => {
    prisma.supplier.create.mockResolvedValueOnce({
      id: 'sup-2',
      tenantId: 'tenant-1',
    });

    const result = await service.create('tenant-1', {
      code: 'SUP-002',
      nameAr: 'مورد',
      nameEn: 'Supplier',
      isActive: true,
    });

    expect(prisma.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          code: 'SUP-002',
        }),
      }),
    );
    expect(result.id).toBe('sup-2');
  });

  it('throws not found when updating supplier outside tenant', async () => {
    prisma.supplier.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.update('tenant-1', 'missing-supplier', {
        nameEn: 'Updated Name',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates supplier after tenant-scoped existence check', async () => {
    prisma.supplier.findFirst.mockResolvedValueOnce({ id: 'sup-3' });
    prisma.supplier.update.mockResolvedValueOnce({
      id: 'sup-3',
      tenantId: 'tenant-1',
      nameEn: 'Updated Name',
    });

    const result = await service.update('tenant-1', 'sup-3', {
      nameEn: 'Updated Name',
    });

    expect(prisma.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'sup-3',
          tenantId: 'tenant-1',
        },
      }),
    );
    expect(prisma.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sup-3' },
        data: { nameEn: 'Updated Name' },
      }),
    );
    expect(result.nameEn).toBe('Updated Name');
  });
});
