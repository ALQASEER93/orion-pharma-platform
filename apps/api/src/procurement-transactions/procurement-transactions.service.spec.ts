import { ConflictException } from '@nestjs/common';
import { ProcurementTransactionsService } from './procurement-transactions.service';

describe('ProcurementTransactionsService', () => {
  const inventoryValuationService = {
    applyMovement: jest.fn(),
  };

  const prisma = {
    purchaseReturn: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: ProcurementTransactionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProcurementTransactionsService(
      prisma as never,
      inventoryValuationService as never,
    );
  });

  it('returns existing purchase return on idempotent replay without double decrement', async () => {
    const requestPayload = {
      goodsReceiptId: 'grn-1',
      idempotencyKey: 'idem-pr-1',
      lines: [{ goodsReceiptLineId: 'grl-1', qtyReturnNow: 1 }],
    };
    const payloadHash = (
      service as unknown as {
        hashPurchaseReturnPayload: (value: unknown) => string;
      }
    ).hashPurchaseReturnPayload(requestPayload);

    const existing = {
      id: 'pr-1',
      tenantId: 'tenant-1',
      goodsReceiptId: 'grn-1',
      idempotencyKey: 'idem-pr-1',
      payloadHash,
      returnNumber: 'PRN-2026-000001',
      lines: [{ qtyReturnedNow: 1 }],
      goodsReceipt: { id: 'grn-1' },
      branch: { id: 'branch-1' },
      supplier: { id: 'supplier-1' },
    };

    const tx = {
      purchaseReturn: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
      goodsReceiptLine: {
        updateMany: jest.fn(),
      },
      inventoryBalance: {
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementationOnce(
      (callback: (trx: unknown) => Promise<unknown>) => callback(tx),
    );

    const result = await service.createPurchaseReturn(
      'tenant-1',
      { sub: 'user-1', permissions: [] } as never,
      requestPayload,
    );

    expect(result.id).toBe('pr-1');
    expect(result.totalQuantityReturned).toBe(1);
    expect(tx.goodsReceiptLine.updateMany).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('rejects over-return with conflict', async () => {
    const tx = {
      purchaseReturn: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      goodsReceipt: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'grn-1',
          tenantId: 'tenant-1',
          branchId: 'branch-1',
          supplierId: 'supplier-1',
          lines: [
            {
              id: 'grl-1',
              productId: 'product-1',
              qtyReceivedNow: 2,
              returnedQuantity: 2,
              product: { trackingMode: 'NONE' },
              batchNo: null,
              expiryDate: null,
            },
          ],
        }),
      },
      goodsReceiptLine: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      documentSequence: {
        upsert: jest.fn().mockResolvedValue({ nextNumber: 2 }),
      },
      inventoryBalance: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mv-1' }),
      },
    };

    prisma.$transaction.mockImplementationOnce(
      (callback: (trx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service.createPurchaseReturn(
        'tenant-1',
        { sub: 'user-1', permissions: [] } as never,
        {
          goodsReceiptId: 'grn-1',
          idempotencyKey: 'idem-pr-2',
          lines: [{ goodsReceiptLineId: 'grl-1', qtyReturnNow: 1 }],
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects insufficient stock with conflict', async () => {
    const tx = {
      purchaseReturn: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      goodsReceipt: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'grn-1',
          tenantId: 'tenant-1',
          branchId: 'branch-1',
          supplierId: 'supplier-1',
          lines: [
            {
              id: 'grl-1',
              productId: 'product-1',
              qtyReceivedNow: 2,
              returnedQuantity: 0,
              product: { trackingMode: 'NONE' },
              batchNo: null,
              expiryDate: null,
            },
          ],
        }),
      },
      goodsReceiptLine: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      documentSequence: {
        upsert: jest.fn().mockResolvedValue({ nextNumber: 2 }),
      },
      inventoryBalance: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mv-2' }),
      },
    };

    prisma.$transaction.mockImplementationOnce(
      (callback: (trx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service.createPurchaseReturn(
        'tenant-1',
        { sub: 'user-1', permissions: [] } as never,
        {
          goodsReceiptId: 'grn-1',
          idempotencyKey: 'idem-pr-3',
          lines: [{ goodsReceiptLineId: 'grl-1', qtyReturnNow: 1 }],
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
