import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FiscalDocumentsService } from './fiscal-documents.service';

function createPrismaMock() {
  const prisma: any = {
    branch: {
      findFirst: jest.fn(),
    },
    register: {
      findFirst: jest.fn(),
    },
    productPack: {
      findFirst: jest.fn(),
    },
    lotBatch: {
      findFirst: jest.fn(),
    },
    fiscalSaleDocument: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    fiscalSaleDocumentLine: {
      findFirst: jest.fn(),
    },
    fiscalReturnDocument: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    fiscalReturnDocumentLine: {
      findFirst: jest.fn(),
    },
    fiscalCreditNoteDocument: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => unknown) => fn(prisma)),
  };

  return prisma;
}

describe('FiscalDocumentsService', () => {
  function primeBranchAndPack(prisma: ReturnType<typeof createPrismaMock>) {
    prisma.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      legalEntityId: 'le-1',
    });
    prisma.productPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prisma.lotBatch.findFirst.mockResolvedValue({
      id: 'lot-1',
      productPackId: 'pack-1',
    });
  }

  it('creates sale document on canonical sale model', async () => {
    const prisma = createPrismaMock();
    primeBranchAndPack(prisma);
    prisma.fiscalSaleDocument.create.mockResolvedValue({ id: 'sale-1' });
    const service = new FiscalDocumentsService(prisma as never);

    const result = await service.createSaleDocument({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      documentNo: 'SALE-1001',
      lines: [
        {
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantity: 2,
          unitPrice: 4,
        },
      ],
    });

    expect(result).toEqual({ id: 'sale-1' });
    expect(prisma.fiscalSaleDocument.create).toHaveBeenCalled();
    expect(prisma.fiscalReturnDocument.create).not.toHaveBeenCalled();
    expect(prisma.fiscalCreditNoteDocument.create).not.toHaveBeenCalled();
  });

  it('rejects return document when source sale is missing', async () => {
    const prisma = createPrismaMock();
    primeBranchAndPack(prisma);
    prisma.fiscalSaleDocument.findFirst.mockResolvedValue(null);
    const service = new FiscalDocumentsService(prisma as never);

    await expect(
      service.createReturnDocument({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        sourceSaleDocumentId: 'sale-missing',
        documentNo: 'RET-1001',
        lines: [
          {
            productPackId: 'pack-1',
            lotBatchId: 'lot-1',
            quantity: 1,
            unitPrice: 4,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a sale or return reference for credit note', async () => {
    const prisma = createPrismaMock();
    primeBranchAndPack(prisma);
    const service = new FiscalDocumentsService(prisma as never);

    await expect(
      service.createCreditNoteDocument({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        documentNo: 'CN-1001',
        lines: [
          {
            quantity: 1,
            unitPrice: 3,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks sale as partially credited when linked credit note is created', async () => {
    const prisma = createPrismaMock();
    primeBranchAndPack(prisma);
    prisma.fiscalSaleDocument.findFirst.mockResolvedValue({
      id: 'sale-1',
      branchId: 'branch-1',
      legalEntityId: 'le-1',
      creditState: 'NONE',
    });
    prisma.fiscalCreditNoteDocument.create.mockResolvedValue({ id: 'cn-1' });
    prisma.fiscalSaleDocument.update.mockResolvedValue({ id: 'sale-1' });
    const service = new FiscalDocumentsService(prisma as never);

    const result = await service.createCreditNoteDocument({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      sourceSaleDocumentId: 'sale-1',
      documentNo: 'CN-2001',
      lines: [
        {
          quantity: 1,
          unitPrice: 2,
        },
      ],
    });

    expect(result).toEqual({ id: 'cn-1' });
    expect(prisma.fiscalSaleDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sale-1' },
        data: { creditState: 'PARTIALLY_CREDITED' },
      }),
    );
  });

  it('enforces explicit state transition rules', async () => {
    const prisma = createPrismaMock();
    prisma.fiscalSaleDocument.findFirst.mockResolvedValue({
      id: 'sale-1',
      state: 'DRAFT',
    });
    const service = new FiscalDocumentsService(prisma as never);

    await expect(
      service.transitionState({
        tenantId: 'tenant-1',
        documentKind: 'SALE',
        documentId: 'sale-1',
        toState: 'ACCEPTED',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates queued state with timestamp for valid transition', async () => {
    const prisma = createPrismaMock();
    prisma.fiscalReturnDocument.findFirst.mockResolvedValue({
      id: 'ret-1',
      state: 'FINALIZED',
    });
    prisma.fiscalReturnDocument.update.mockResolvedValue({ id: 'ret-1' });
    const service = new FiscalDocumentsService(prisma as never);

    await service.transitionState({
      tenantId: 'tenant-1',
      documentKind: 'RETURN',
      documentId: 'ret-1',
      toState: 'QUEUED',
    });

    expect(prisma.fiscalReturnDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ret-1' },
        data: expect.objectContaining({
          state: 'QUEUED',
          queuedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects register/branch mismatch for fiscal documents', async () => {
    const prisma = createPrismaMock();
    primeBranchAndPack(prisma);
    prisma.register.findFirst.mockResolvedValue({
      id: 'reg-1',
      branchId: 'branch-9',
      legalEntityId: 'le-1',
    });
    const service = new FiscalDocumentsService(prisma as never);

    await expect(
      service.createSaleDocument({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        registerId: 'reg-1',
        documentNo: 'SALE-2002',
        lines: [
          {
            productPackId: 'pack-1',
            lotBatchId: 'lot-1',
            quantity: 1,
            unitPrice: 5,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
