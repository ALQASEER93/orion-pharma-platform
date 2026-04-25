import { ConflictException } from '@nestjs/common';
import { ProcurementReceivingService } from './procurement-receiving.service';

function createPrismaMock() {
  const prisma: any = {
    branch: {
      findFirst: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    productPack: {
      findFirst: jest.fn(),
    },
    lotBatch: {
      findFirst: jest.fn(),
    },
    supplierStockReceipt: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    supplierStockReceiptLine: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    supplierStockReturn: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    supplierStockReturnLine: {
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryLotBalance: {
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    inventoryLedgerEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
  };

  return prisma;
}

describe('ProcurementReceivingService', () => {
  function primeContext(prisma: ReturnType<typeof createPrismaMock>) {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.supplier.findFirst.mockResolvedValue({ id: 'supplier-1' });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-1',
    });
  }

  it('creates supplier stock receipt and links to inventory ledger stock-in', async () => {
    const prisma = createPrismaMock();
    primeContext(prisma);
    prisma.supplierStockReceipt.create.mockResolvedValue({ id: 'receipt-1' });
    prisma.supplierStockReceiptLine.create.mockResolvedValue({
      id: 'receipt-line-1',
    });
    prisma.inventoryLotBalance.upsert.mockResolvedValue({});
    prisma.inventoryLotBalance.update.mockResolvedValue({});
    prisma.inventoryLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
    prisma.supplierStockReceiptLine.update.mockResolvedValue({});
    prisma.supplierStockReceipt.findUniqueOrThrow.mockResolvedValue({
      id: 'receipt-1',
      lines: [],
    });
    const service = new ProcurementReceivingService(prisma as never);

    const result = await service.createSupplierStockReceipt({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      supplierId: 'supplier-1',
      receiptNumber: 'SSR-1001',
      lines: [
        {
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantityReceived: 10,
          unitCost: 2,
        },
      ],
    });

    expect(result).toEqual({ id: 'receipt-1', lines: [] });
    expect(prisma.inventoryLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: 'STOCK_IN',
          referenceType: 'SUPPLIER_RECEIPT',
          quantityDelta: 10,
        }),
      }),
    );
  });

  it('rejects receipt line when lot batch is not linked to product pack', async () => {
    const prisma = createPrismaMock();
    primeContext(prisma);
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-other',
    });
    prisma.supplierStockReceipt.create.mockResolvedValue({ id: 'receipt-1' });
    const service = new ProcurementReceivingService(prisma as never);

    await expect(
      service.createSupplierStockReceipt({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        supplierId: 'supplier-1',
        receiptNumber: 'SSR-1002',
        lines: [
          {
            productPackId: 'pack-1',
            lotBatchId: 'lot-1',
            quantityReceived: 5,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates supplier stock return anchor and links stock-out ledger movement', async () => {
    const prisma = createPrismaMock();
    primeContext(prisma);
    prisma.supplierStockReceipt.findFirst.mockResolvedValue({
      id: 'receipt-1',
      branchId: 'branch-1',
    });
    prisma.supplierStockReturn.create.mockResolvedValue({ id: 'return-1' });
    prisma.supplierStockReceiptLine.findFirst.mockResolvedValue({
      id: 'receipt-line-1',
      receiptId: 'receipt-1',
      productPackId: 'pack-1',
      lotBatchId: 'lot-1',
      quantityReceived: 20,
      returnedQuantity: 3,
    });
    prisma.supplierStockReturnLine.create.mockResolvedValue({
      id: 'return-line-1',
    });
    prisma.inventoryLotBalance.upsert.mockResolvedValue({});
    prisma.inventoryLotBalance.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryLedgerEntry.create.mockResolvedValue({ id: 'ledger-2' });
    prisma.supplierStockReturnLine.update.mockResolvedValue({});
    prisma.supplierStockReceiptLine.update.mockResolvedValue({});
    prisma.supplierStockReturn.findUniqueOrThrow.mockResolvedValue({
      id: 'return-1',
      lines: [],
    });
    const service = new ProcurementReceivingService(prisma as never);

    const result = await service.createSupplierStockReturn({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      supplierId: 'supplier-1',
      sourceReceiptId: 'receipt-1',
      returnNumber: 'SRT-1001',
      lines: [
        {
          sourceReceiptLineId: 'receipt-line-1',
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantityReturned: 4,
        },
      ],
    });

    expect(result).toEqual({ id: 'return-1', lines: [] });
    expect(prisma.inventoryLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: 'STOCK_OUT',
          referenceType: 'SUPPLIER_RETURN',
          quantityDelta: -4,
        }),
      }),
    );
    expect(prisma.supplierStockReceiptLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'receipt-line-1' },
        data: { returnedQuantity: { increment: 4 } },
      }),
    );
  });

  it('blocks supplier return when lot balance is insufficient', async () => {
    const prisma = createPrismaMock();
    primeContext(prisma);
    prisma.supplierStockReturn.create.mockResolvedValue({ id: 'return-1' });
    prisma.supplierStockReturnLine.create.mockResolvedValue({
      id: 'return-line-1',
    });
    prisma.inventoryLotBalance.upsert.mockResolvedValue({});
    prisma.inventoryLotBalance.updateMany.mockResolvedValue({ count: 0 });
    prisma.supplierStockReturn.findUniqueOrThrow.mockResolvedValue({
      id: 'return-1',
      lines: [],
    });
    const service = new ProcurementReceivingService(prisma as never);

    await expect(
      service.createSupplierStockReturn({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        supplierId: 'supplier-1',
        returnNumber: 'SRT-1002',
        lines: [
          {
            productPackId: 'pack-1',
            lotBatchId: 'lot-1',
            quantityReturned: 2,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
