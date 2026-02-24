import { BadRequestException } from '@nestjs/common';
import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersService', () => {
  const prisma = {
    branch: {
      findFirst: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    purchaseOrder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: PurchaseOrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PurchaseOrdersService(prisma as never);
  });

  it('returns list with computed totals', async () => {
    prisma.purchaseOrder.findMany.mockResolvedValueOnce([
      {
        id: 'po-1',
        tenantId: 'tenant-1',
        poNumber: 'PO-2026-000001',
        lines: [
          { quantity: 2, lineTotal: 20 },
          { quantity: 3, lineTotal: 15 },
        ],
      },
    ]);

    const result = await service.list('tenant-1', {});

    expect(result[0].totalQuantity).toBe(5);
    expect(result[0].totalAmount).toBe(35);
  });

  it('rejects create when one product is outside tenant', async () => {
    prisma.branch.findFirst.mockResolvedValueOnce({ id: 'branch-1' });
    prisma.supplier.findFirst.mockResolvedValueOnce({ id: 'supplier-1' });
    prisma.product.count.mockResolvedValueOnce(1);

    await expect(
      service.create('tenant-1', {
        branchId: 'branch-1',
        supplierId: 'supplier-1',
        lines: [
          { productId: 'product-1', quantity: 2, unitPrice: 10 },
          { productId: 'product-2', quantity: 1, unitPrice: 5 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates draft purchase order with immutable generated number', async () => {
    prisma.branch.findFirst.mockResolvedValueOnce({ id: 'branch-1' });
    prisma.supplier.findFirst.mockResolvedValueOnce({ id: 'supplier-1' });
    prisma.product.count.mockResolvedValueOnce(1);
    prisma.$transaction.mockImplementationOnce(
      (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          documentSequence: {
            upsert: jest.fn().mockResolvedValue({ nextNumber: 2 }),
          },
          purchaseOrder: {
            create: jest.fn().mockResolvedValue({
              id: 'po-1',
              tenantId: 'tenant-1',
              poNumber: 'PO-2026-000001',
              status: PurchaseOrderStatus.DRAFT,
              lines: [{ quantity: 2, lineTotal: 20 }],
              supplier: { id: 'supplier-1' },
              branch: { id: 'branch-1' },
            }),
          },
        }),
    );

    const result = await service.create('tenant-1', {
      branchId: 'branch-1',
      supplierId: 'supplier-1',
      lines: [{ productId: 'product-1', quantity: 2, unitPrice: 10 }],
    });

    expect(result.poNumber).toContain('PO-');
    expect(result.status).toBe(PurchaseOrderStatus.DRAFT);
    expect(result.totalAmount).toBe(20);
  });
});
