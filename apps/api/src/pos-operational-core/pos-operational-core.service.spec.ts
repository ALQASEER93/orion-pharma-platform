import { ConflictException } from '@nestjs/common';
import { PosOperationalCoreService } from './pos-operational-core.service';

function createPrismaMock() {
  const prisma: any = {
    branch: { findFirst: jest.fn() },
    register: { findFirst: jest.fn() },
    documentSequence: { upsert: jest.fn() },
    productPack: { findFirst: jest.fn() },
    lotBatch: { findFirst: jest.fn() },
    fiscalSaleDocumentLine: { findFirst: jest.fn() },
    fiscalReturnDocumentLine: { aggregate: jest.fn() },
    fiscalSaleDocument: { create: jest.fn(), findFirst: jest.fn() },
    fiscalReturnDocument: { create: jest.fn() },
    posCartSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    posCartLine: {
      create: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    posReturnSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    posReturnLine: {
      create: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    posPaymentFinalization: { create: jest.fn() },
    inventoryLotBalance: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryLedgerEntry: { create: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: any) => unknown) => fn(prisma)),
  };
  return prisma;
}

describe('PosOperationalCoreService', () => {
  it('creates draft cart session successfully', async () => {
    const prisma = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', legalEntityId: 'le-1' });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.documentSequence.upsert.mockResolvedValue({ nextNumber: 2 });
    prisma.posCartSession.create.mockResolvedValue({
      id: 'cart-1',
      state: 'OPEN',
      sessionNumber: 'PCS-2026-000001',
    });
    const service = new PosOperationalCoreService(prisma as never);

    const result = await service.createCartSession({
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      branchId: 'branch-1',
      registerId: 'reg-1',
      createdBy: 'user-1',
    });

    expect(result).toEqual({
      id: 'cart-1',
      state: 'OPEN',
      sessionNumber: 'PCS-2026-000001',
    });
  });

  it('rejects cart session creation when register does not belong to branch', async () => {
    const prisma = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', legalEntityId: 'le-1' });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-2',
      legalEntityId: 'le-1',
    });
    const service = new PosOperationalCoreService(prisma as never);

    await expect(
      service.createCartSession({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        registerId: 'reg-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks cart line mutation after cart finalization (immutable finalized sale)', async () => {
    const prisma = createPrismaMock();
    prisma.posCartSession.findFirst.mockResolvedValue({ id: 'cart-1', state: 'FINALIZED' });
    const service = new PosOperationalCoreService(prisma as never);

    await expect(
      service.addCartLine({
        tenantId: 'tenant-1',
        cartSessionId: 'cart-1',
        productPackId: 'pack-1',
        lotBatchId: 'lot-1',
        quantity: 1,
        unitPrice: 5,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finalizes sale with fiscal + ledger + payment anchors', async () => {
    const prisma = createPrismaMock();
    prisma.posCartSession.findFirst.mockResolvedValue({
      id: 'cart-1',
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      branchId: 'branch-1',
      registerId: 'reg-1',
      state: 'OPEN',
      currency: 'JOD',
      createdBy: 'user-1',
      lines: [
        {
          id: 'cart-line-1',
          lineNo: 1,
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantity: 2,
          unitPrice: 10,
          discount: 0,
          taxRate: 0,
          lineTotal: 20,
        },
      ],
    });
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', legalEntityId: 'le-1' });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.documentSequence.upsert.mockResolvedValue({ nextNumber: 2 });
    prisma.fiscalSaleDocument.create.mockResolvedValue({
      id: 'fsd-1',
      lines: [{ id: 'fsd-line-1', lineNo: 1 }],
    });
    prisma.inventoryLotBalance.upsert.mockResolvedValue({});
    prisma.inventoryLotBalance.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
    prisma.posCartLine.update.mockResolvedValue({});
    prisma.posPaymentFinalization.create.mockResolvedValue({});
    prisma.posCartSession.update.mockResolvedValue({});
    prisma.posCartSession.findUniqueOrThrow.mockResolvedValue({
      id: 'cart-1',
      state: 'FINALIZED',
      lines: [],
      paymentFinalizations: [],
    });
    const service = new PosOperationalCoreService(prisma as never);

    const result = await service.finalizeCartPayment({
      tenantId: 'tenant-1',
      cartSessionId: 'cart-1',
      paymentMethod: 'CASH',
    });

    expect(result).toEqual({
      id: 'cart-1',
      state: 'FINALIZED',
      lines: [],
      paymentFinalizations: [],
    });
    expect(prisma.inventoryLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: 'STOCK_OUT',
          referenceType: 'SALE',
          postingSurface: 'REGISTER',
          quantityDelta: -2,
        }),
      }),
    );
    expect(prisma.posPaymentFinalization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flowType: 'SALE_FINALIZATION',
          state: 'FINALIZED',
          amountApplied: 20,
        }),
      }),
    );
  });

  it('blocks duplicate finalize attempts on the same cart', async () => {
    const prisma = createPrismaMock();
    prisma.posCartSession.findFirst.mockResolvedValue({
      id: 'cart-1',
      state: 'FINALIZED',
      lines: [],
    });
    const service = new PosOperationalCoreService(prisma as never);

    await expect(
      service.finalizeCartPayment({
        tenantId: 'tenant-1',
        cartSessionId: 'cart-1',
        paymentMethod: 'CASH',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails sale finalization when inventory is insufficient', async () => {
    const prisma = createPrismaMock();
    prisma.posCartSession.findFirst.mockResolvedValue({
      id: 'cart-1',
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      branchId: 'branch-1',
      registerId: 'reg-1',
      state: 'OPEN',
      currency: 'JOD',
      createdBy: 'user-1',
      lines: [
        {
          id: 'cart-line-1',
          lineNo: 1,
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantity: 3,
          unitPrice: 10,
          discount: 0,
          taxRate: 0,
          lineTotal: 30,
        },
      ],
    });
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', legalEntityId: 'le-1' });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.documentSequence.upsert.mockResolvedValue({ nextNumber: 2 });
    prisma.fiscalSaleDocument.create.mockResolvedValue({
      id: 'fsd-1',
      lines: [{ id: 'fsd-line-1', lineNo: 1 }],
    });
    prisma.inventoryLotBalance.upsert.mockResolvedValue({});
    prisma.inventoryLotBalance.updateMany.mockResolvedValue({ count: 0 });
    const service = new PosOperationalCoreService(prisma as never);

    await expect(
      service.finalizeCartPayment({
        tenantId: 'tenant-1',
        cartSessionId: 'cart-1',
        paymentMethod: 'CASH',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates return session against finalized sale', async () => {
    const prisma = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', legalEntityId: 'le-1' });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.fiscalSaleDocument.findFirst.mockResolvedValue({
      id: 'sale-1',
      branchId: 'branch-1',
      state: 'FINALIZED',
    });
    prisma.documentSequence.upsert.mockResolvedValue({ nextNumber: 2 });
    prisma.posReturnSession.create.mockResolvedValue({
      id: 'ret-1',
      sourceSaleDocumentId: 'sale-1',
      state: 'OPEN',
    });
    const service = new PosOperationalCoreService(prisma as never);

    const result = await service.createReturnSession({
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      branchId: 'branch-1',
      registerId: 'reg-1',
      sourceSaleDocumentId: 'sale-1',
    });

    expect(result).toEqual({
      id: 'ret-1',
      sourceSaleDocumentId: 'sale-1',
      state: 'OPEN',
    });
  });

  it('rejects return session when source sale is not finalized', async () => {
    const prisma = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', legalEntityId: 'le-1' });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.fiscalSaleDocument.findFirst.mockResolvedValue({
      id: 'sale-1',
      branchId: 'branch-1',
      state: 'DRAFT',
    });
    const service = new PosOperationalCoreService(prisma as never);

    await expect(
      service.createReturnSession({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        registerId: 'reg-1',
        sourceSaleDocumentId: 'sale-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects return line when quantity exceeds remaining source sale quantity', async () => {
    const prisma = createPrismaMock();
    prisma.posReturnSession.findFirst.mockResolvedValue({
      id: 'ret-1',
      state: 'OPEN',
      branchId: 'branch-1',
      sourceSaleDocumentId: 'sale-1',
    });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-1',
      isSellable: true,
      status: 'AVAILABLE',
    });
    prisma.fiscalSaleDocumentLine.findFirst.mockResolvedValue({
      id: 'sale-line-1',
      saleDocumentId: 'sale-1',
      quantity: 2,
      productPackId: 'pack-1',
      lotBatchId: 'lot-1',
      saleDocument: { id: 'sale-1', branchId: 'branch-1', state: 'FINALIZED' },
    });
    prisma.fiscalReturnDocumentLine.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    prisma.posReturnLine.aggregate.mockResolvedValue({ _sum: { quantityReturned: 0 } });
    const service = new PosOperationalCoreService(prisma as never);

    await expect(
      service.addReturnLine({
        tenantId: 'tenant-1',
        returnSessionId: 'ret-1',
        sourceSaleLineId: 'sale-line-1',
        productPackId: 'pack-1',
        lotBatchId: 'lot-1',
        quantityReturned: 2,
        unitPrice: 10,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('supports partial return within remaining source sale quantity', async () => {
    const prisma = createPrismaMock();
    prisma.posReturnSession.findFirst.mockResolvedValue({
      id: 'ret-1',
      state: 'OPEN',
      branchId: 'branch-1',
      sourceSaleDocumentId: 'sale-1',
    });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-1',
      isSellable: true,
      status: 'AVAILABLE',
    });
    prisma.fiscalSaleDocumentLine.findFirst.mockResolvedValue({
      id: 'sale-line-1',
      saleDocumentId: 'sale-1',
      quantity: 10,
      productPackId: 'pack-1',
      lotBatchId: 'lot-1',
      saleDocument: { id: 'sale-1', branchId: 'branch-1', state: 'FINALIZED' },
    });
    prisma.fiscalReturnDocumentLine.aggregate.mockResolvedValue({ _sum: { quantity: 4 } });
    prisma.posReturnLine.aggregate
      .mockResolvedValueOnce({ _sum: { quantityReturned: 2 } })
      .mockResolvedValueOnce({ _max: { lineNo: 3 } });
    prisma.posReturnLine.create.mockResolvedValue({
      id: 'return-line-1',
      lineNo: 4,
      quantityReturned: 3,
    });
    prisma.posReturnLine.findMany.mockResolvedValue([
      {
        quantityReturned: 3,
        unitPrice: 10,
        discount: 0,
        taxRate: 0,
      },
    ]);
    prisma.posReturnSession.update.mockResolvedValue({});
    const service = new PosOperationalCoreService(prisma as never);

    const result = await service.addReturnLine({
      tenantId: 'tenant-1',
      returnSessionId: 'ret-1',
      sourceSaleLineId: 'sale-line-1',
      productPackId: 'pack-1',
      lotBatchId: 'lot-1',
      quantityReturned: 3,
      unitPrice: 10,
    });

    expect(result).toEqual({
      id: 'return-line-1',
      lineNo: 4,
      quantityReturned: 3,
    });
  });

  it('finalizes return with fiscal + stock-in + refund anchor', async () => {
    const prisma = createPrismaMock();
    prisma.posReturnSession.findFirst.mockResolvedValue({
      id: 'ret-1',
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      branchId: 'branch-1',
      registerId: 'reg-1',
      state: 'OPEN',
      currency: 'JOD',
      createdBy: 'user-1',
      sourceSaleDocumentId: 'fsd-source-1',
      lines: [
        {
          id: 'ret-line-1',
          lineNo: 1,
          sourceSaleLineId: 'fsd-line-source-1',
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantityReturned: 1,
          unitPrice: 10,
          discount: 0,
          taxRate: 0,
          lineTotal: 10,
          reasonCode: 'DAMAGED',
        },
      ],
    });
    prisma.fiscalSaleDocument.findFirst.mockResolvedValue({
      id: 'fsd-source-1',
      branchId: 'branch-1',
      state: 'FINALIZED',
    });
    prisma.fiscalSaleDocumentLine.findFirst.mockResolvedValue({
      id: 'fsd-line-source-1',
      quantity: 2,
    });
    prisma.fiscalReturnDocumentLine.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', legalEntityId: 'le-1' });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.documentSequence.upsert.mockResolvedValue({ nextNumber: 2 });
    prisma.fiscalReturnDocument.create.mockResolvedValue({
      id: 'frd-1',
      lines: [{ id: 'frd-line-1', lineNo: 1 }],
    });
    prisma.inventoryLotBalance.upsert.mockResolvedValue({});
    prisma.inventoryLotBalance.update.mockResolvedValue({});
    prisma.inventoryLedgerEntry.create.mockResolvedValue({ id: 'ledger-2' });
    prisma.posReturnLine.update.mockResolvedValue({});
    prisma.posPaymentFinalization.create.mockResolvedValue({});
    prisma.posReturnSession.update.mockResolvedValue({});
    prisma.posReturnSession.findUniqueOrThrow.mockResolvedValue({
      id: 'ret-1',
      state: 'FINALIZED',
      lines: [],
      paymentFinalizations: [],
    });
    const service = new PosOperationalCoreService(prisma as never);

    const result = await service.finalizeReturn({
      tenantId: 'tenant-1',
      returnSessionId: 'ret-1',
      refundMethod: 'CARD',
    });

    expect(result).toEqual({
      id: 'ret-1',
      state: 'FINALIZED',
      lines: [],
      paymentFinalizations: [],
    });
    expect(prisma.inventoryLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: 'STOCK_IN',
          referenceType: 'RETURN',
          postingSurface: 'REGISTER',
          quantityDelta: 1,
        }),
      }),
    );
    expect(prisma.posPaymentFinalization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flowType: 'RETURN_REFUND',
          state: 'FINALIZED',
          amountApplied: 10,
          paymentMethod: 'CARD',
        }),
      }),
    );
  });
});
