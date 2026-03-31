import { PosOperationalCoreController } from './pos-operational-core.controller';

function createControllerHarness() {
  const service = {
    createCartSession: jest.fn(),
    getCartSession: jest.fn(),
    addCartLine: jest.fn(),
    updateCartLine: jest.fn(),
    removeCartLine: jest.fn(),
    finalizeCartPayment: jest.fn(),
    createReturnSession: jest.fn(),
    getReturnSession: jest.fn(),
    addReturnLine: jest.fn(),
    finalizeReturn: jest.fn(),
  };

  const prisma = {
    branch: { findMany: jest.fn() },
    register: { findMany: jest.fn() },
    productPack: { findMany: jest.fn() },
    posCartSession: { findMany: jest.fn() },
    fiscalSaleDocument: { findMany: jest.fn(), findFirst: jest.fn() },
    fiscalReturnDocumentLine: { findMany: jest.fn() },
  };

  return {
    service,
    prisma,
    controller: new PosOperationalCoreController(service as never, prisma as never),
  };
}

describe('PosOperationalCoreController', () => {
  it('lists finalized sales with register-aware lookup metadata', async () => {
    const { controller, prisma } = createControllerHarness();
    const response = [
      {
        id: 'sale-1',
        documentNo: 'FSD-POS-2026-000001',
        state: 'FINALIZED',
        branchId: 'branch-1',
        registerId: 'register-1',
        grandTotal: 25,
        currency: 'JOD',
        finalizedAt: new Date('2026-03-30T08:00:00.000Z'),
        createdAt: new Date('2026-03-30T07:59:00.000Z'),
        posCartSession: { sessionNumber: 'PCS-2026-000001' },
        paymentFinalizations: [
          {
            paymentMethod: 'CASH',
            finalizedAt: new Date('2026-03-30T08:00:00.000Z'),
            referenceCode: null,
          },
        ],
      },
    ];
    prisma.fiscalSaleDocument.findMany.mockResolvedValueOnce(response);

    const result = await controller.listFinalizedSales(
      { user: { tenantId: 'tenant-1' } } as never,
      { branchId: 'branch-1', registerId: 'register-1', search: 'PCS-2026-000001' },
    );

    expect(prisma.fiscalSaleDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          branchId: 'branch-1',
          registerId: 'register-1',
        }),
      }),
    );
    expect(result).toEqual(response);
  });

  it('computes remaining quantity when loading finalized sale detail', async () => {
    const { controller, prisma } = createControllerHarness();
    prisma.fiscalSaleDocument.findFirst.mockResolvedValueOnce({
      id: 'sale-1',
      documentNo: 'FSD-POS-2026-000001',
      state: 'FINALIZED',
      branchId: 'branch-1',
      registerId: 'register-1',
      grandTotal: 25,
      currency: 'JOD',
      finalizedAt: new Date('2026-03-30T08:00:00.000Z'),
      posCartSession: { sessionNumber: 'PCS-2026-000001' },
      paymentFinalizations: [
        {
          paymentMethod: 'CASH',
          finalizedAt: new Date('2026-03-30T08:00:00.000Z'),
          referenceCode: null,
        },
      ],
      lines: [
        {
          id: 'sale-line-1',
          lineNo: 1,
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          quantity: 3,
          unitPrice: 5,
          taxRate: 0,
          discount: 0,
          lineTotal: 15,
          productPack: { code: 'PACK-1', barcode: '123', product: { nameEn: 'Paracetamol', nameAr: 'باراسيتامول' } },
          lotBatch: { batchNo: 'B-1', expiryDate: new Date('2027-01-01T00:00:00.000Z') },
        },
      ],
    });
    prisma.fiscalReturnDocumentLine.findMany.mockResolvedValueOnce([
      { sourceSaleLineId: 'sale-line-1', quantity: 1 },
    ]);

    const result = await controller.getFinalizedSaleDetail(
      { user: { tenantId: 'tenant-1' } } as never,
      'sale-1',
    );

    expect(result?.lines[0]).toEqual(
      expect.objectContaining({
        alreadyReturnedQty: 1,
        remainingQty: 2,
      }),
    );
  });
});
