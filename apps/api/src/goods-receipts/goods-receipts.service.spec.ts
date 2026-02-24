import { ConflictException } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';

describe('GoodsReceiptsService', () => {
  const prisma = {
    goodsReceipt: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    purchaseOrder: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrderLine: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    documentSequence: {
      upsert: jest.fn(),
    },
    inventoryBalance: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: GoodsReceiptsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GoodsReceiptsService(prisma as never);
  });

  it('rejects over-receipt with conflict', async () => {
    prisma.$transaction.mockImplementationOnce(
      (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          goodsReceipt: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          purchaseOrder: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'po-1',
              tenantId: 'tenant-1',
              branchId: 'branch-1',
              supplierId: 'supplier-1',
              status: 'APPROVED',
              lines: [
                {
                  id: 'line-1',
                  productId: 'product-1',
                  quantity: 5,
                  receivedQuantity: 4,
                  product: { trackingMode: 'NONE' },
                },
              ],
            }),
          },
          purchaseOrderLine: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        }),
    );

    await expect(
      service.create('tenant-1', { sub: 'user-1', permissions: [] } as never, {
        purchaseOrderId: 'po-1',
        idempotencyKey: 'idem-1',
        lines: [{ purchaseOrderLineId: 'line-1', qtyReceivedNow: 2 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns existing GRN on idempotent replay without posting inventory again', async () => {
    const requestPayload = {
      purchaseOrderId: 'po-1',
      idempotencyKey: 'idem-1',
      lines: [{ purchaseOrderLineId: 'line-1', qtyReceivedNow: 1 }],
    };
    const payloadHash = (
      service as unknown as { hashPayload: (value: unknown) => string }
    ).hashPayload(requestPayload);

    const existing = {
      id: 'grn-1',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      supplierId: 'supplier-1',
      purchaseOrderId: 'po-1',
      idempotencyKey: 'idem-1',
      payloadHash,
      lines: [{ qtyReceivedNow: 1 }],
      supplier: { id: 'supplier-1' },
      branch: { id: 'branch-1' },
      purchaseOrder: { id: 'po-1' },
    };

    const tx = {
      goodsReceipt: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
      purchaseOrder: {
        findFirst: jest.fn(),
      },
      purchaseOrderLine: {
        updateMany: jest.fn(),
      },
      documentSequence: {
        upsert: jest.fn(),
      },
      inventoryBalance: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      purchaseOrderUpdate: jest.fn(),
    };

    prisma.$transaction.mockImplementationOnce(
      (callback: (trx: unknown) => Promise<unknown>) => callback(tx),
    );

    const result = await service.create(
      'tenant-1',
      { sub: 'user-1', permissions: [] } as never,
      requestPayload,
    );

    expect(result.id).toBe('grn-1');
    expect(result.totalReceivedQuantity).toBe(1);
    expect(tx.purchaseOrder.findFirst).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
