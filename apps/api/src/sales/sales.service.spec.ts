import { ConflictException, NotFoundException } from '@nestjs/common';
import { SalesInvoiceStatus } from '@prisma/client';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  const prisma = {
    salesInvoice: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: SalesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalesService(prisma as never);
  });

  it('lists invoices by tenant', async () => {
    prisma.salesInvoice.findMany.mockResolvedValueOnce([
      {
        id: 'inv-1',
        tenantId: 'tenant-1',
        invoiceNo: 'SI-2026-000001',
        status: SalesInvoiceStatus.DRAFT,
        lines: [{ qty: 2, lineTotal: 20 }],
      },
    ]);

    const result = await service.listInvoices('tenant-1', { q: 'SI' });

    expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      }),
    );
    expect(result[0].totalQuantity).toBe(2);
  });

  it('throws not found on missing invoice detail', async () => {
    prisma.salesInvoice.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.detailInvoice('tenant-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects posting invoice without lines', async () => {
    const tx = {
      salesInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-1',
          tenantId: 'tenant-1',
          status: SalesInvoiceStatus.DRAFT,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      salesInvoiceLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    prisma.$transaction.mockImplementationOnce(
      (callback: (trx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service.postInvoice('tenant-1', undefined, 'inv-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
