import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const prisma = {
    customer: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: CustomersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomersService(prisma as never);
  });

  it('lists customers by tenant and search query', async () => {
    prisma.customer.findMany.mockResolvedValueOnce([
      { id: 'cust-1', tenantId: 'tenant-1', name: 'Alpha Pharmacy' },
    ]);

    const result = await service.list('tenant-1', { q: 'Alpha' });

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('creates customer with tenant isolation', async () => {
    prisma.customer.create.mockResolvedValueOnce({
      id: 'cust-2',
      tenantId: 'tenant-1',
      name: 'Bravo Clinic',
    });

    const result = await service.create('tenant-1', {
      name: 'Bravo Clinic',
      phone: '+966500000001',
      email: 'bravo@clinic.local',
    });

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Bravo Clinic',
        }),
      }),
    );
    expect(result.id).toBe('cust-2');
  });

  it('throws not found when reading outside tenant', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce(null);

    await expect(service.detail('tenant-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates customer after tenant-scoped existence check', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({ id: 'cust-3' });
    prisma.customer.update.mockResolvedValueOnce({
      id: 'cust-3',
      tenantId: 'tenant-1',
      name: 'Updated',
    });

    const result = await service.update('tenant-1', 'cust-3', {
      name: 'Updated',
    });

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-3', tenantId: 'tenant-1' },
      }),
    );
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-3' },
        data: { name: 'Updated' },
      }),
    );
    expect(result.name).toBe('Updated');
  });
});
