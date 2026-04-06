import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryLedgerService } from './inventory-ledger.service';

function createPrismaMock() {
  const tx = {
    inventoryLotBalance: {
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    inventoryLedgerEntry: {
      create: jest.fn(),
    },
  };

  const prisma = {
    branch: { findFirst: jest.fn() },
    productPack: { findFirst: jest.fn() },
    lotBatch: { findFirst: jest.fn() },
    register: { findFirst: jest.fn() },
    inventoryLotBalance: { findMany: jest.fn() },
    $transaction: jest.fn(async (fn: (trx: typeof tx) => unknown) => fn(tx)),
  };

  return { prisma, tx };
}

describe('InventoryLedgerService', () => {
  it('requires registerId when posting surface is REGISTER', async () => {
    const { prisma } = createPrismaMock();
    const service = new InventoryLedgerService(prisma as never);

    await expect(
      service.createEntry({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        productPackId: 'pack-1',
        lotBatchId: 'lot-1',
        entryType: 'STOCK_IN',
        postingSurface: 'REGISTER',
        quantityDelta: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects register that does not belong to branch', async () => {
    const { prisma } = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-1',
    });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-other',
      legalEntityId: 'le-1',
    });
    const service = new InventoryLedgerService(prisma as never);

    await expect(
      service.createEntry({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        registerId: 'reg-1',
        productPackId: 'pack-1',
        lotBatchId: 'lot-1',
        entryType: 'STOCK_OUT',
        postingSurface: 'REGISTER',
        quantityDelta: -2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects lot batch when not linked to product pack', async () => {
    const { prisma } = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      legalEntityId: null,
    });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-other',
    });
    const service = new InventoryLedgerService(prisma as never);

    await expect(
      service.createEntry({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        productPackId: 'pack-1',
        lotBatchId: 'lot-1',
        entryType: 'STOCK_IN',
        quantityDelta: 4,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks negative ledger movement when lot balance is insufficient', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      legalEntityId: null,
    });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-1',
    });
    tx.inventoryLotBalance.upsert.mockResolvedValue({});
    tx.inventoryLotBalance.updateMany.mockResolvedValue({ count: 0 });
    const service = new InventoryLedgerService(prisma as never);

    await expect(
      service.createEntry({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        productPackId: 'pack-1',
        lotBatchId: 'lot-1',
        entryType: 'STOCK_OUT',
        quantityDelta: -1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates ledger entry and updates lot balance for register posting', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-1',
    });
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
    });
    tx.inventoryLotBalance.upsert.mockResolvedValue({});
    tx.inventoryLotBalance.update.mockResolvedValue({});
    tx.inventoryLedgerEntry.create.mockResolvedValue({ id: 'entry-1' });
    const service = new InventoryLedgerService(prisma as never);

    const result = await service.createEntry({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      registerId: 'reg-1',
      productPackId: 'pack-1',
      lotBatchId: 'lot-1',
      entryType: 'STOCK_IN',
      postingSurface: 'REGISTER',
      referenceType: 'FOUNDATION',
      stockBucket: 'SELLABLE',
      quantityDelta: 12,
      unitCost: 1.5,
      createdBy: 'user-1',
    });

    expect(result).toEqual({ id: 'entry-1' });
    expect(tx.inventoryLotBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onHandQuantity: { increment: 12 },
          sellableQuantity: { increment: 12 },
        }),
      }),
    );
    expect(tx.inventoryLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          legalEntityId: 'le-1',
          registerId: 'reg-1',
          postingSurface: 'REGISTER',
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantityDelta: 12,
          amountTotal: 18,
        }),
      }),
    );
  });

  it('throws when branch is missing from tenant', async () => {
    const { prisma } = createPrismaMock();
    prisma.branch.findFirst.mockResolvedValue(null);
    const service = new InventoryLedgerService(prisma as never);

    await expect(
      service.createEntry({
        tenantId: 'tenant-1',
        branchId: 'missing-branch',
        productPackId: 'pack-1',
        lotBatchId: 'lot-1',
        entryType: 'STOCK_IN',
        quantityDelta: 3,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
