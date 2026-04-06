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
        lines: [
          {
            id: 'sale-line-1',
            lineNo: 1,
            quantity: 2,
            displayNameEn: 'Panadol Cold',
            displayNameAr: 'بنادول كولد',
            sellableCode: 'PACK-1',
            batchNoSnapshot: 'B-1',
            productPack: {
              code: 'PACK-CHANGED',
              product: { nameEn: 'Live renamed', nameAr: 'اسم حي' },
            },
            lotBatch: { batchNo: 'LIVE-BATCH' },
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
    expect(result).toEqual([
      expect.objectContaining({
        id: 'sale-1',
        lines: [
          {
            id: 'sale-line-1',
            lineNo: 1,
            quantity: 2,
            displayNameEn: 'Panadol Cold',
            displayNameAr: 'بنادول كولد',
            sellableCode: 'PACK-1',
            batchNo: 'B-1',
          },
        ],
      }),
    ]);
  });

  it('computes remaining quantity and preserves immutable line snapshot when loading finalized sale detail', async () => {
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
          productId: 'product-1',
          productPackId: 'pack-1',
          lotBatchId: 'lot-1',
          displayNameEn: 'Paracetamol Snapshot',
          displayNameAr: 'باراسيتامول محفوظ',
          genericNameEn: 'Acetaminophen Snapshot',
          genericNameAr: 'أسيتامينوفين محفوظ',
          strengthLabel: '500mg',
          dosageFormNameEn: 'Tablet',
          dosageFormNameAr: 'أقراص',
          barcodeUsed: 'SNAP-123',
          sellableCode: 'PACK-SNAPSHOT',
          packLabel: 'Pack PACK-SNAPSHOT · 20 tabs',
          batchNoSnapshot: 'SNAP-B-1',
          expiryDateSnapshot: new Date('2027-01-01T00:00:00.000Z'),
          taxProfileCode: 'READINESS_STANDARD',
          quantity: 3,
          unitPrice: 5,
          taxRate: 0,
          discount: 0,
          lineTotal: 15,
          productPack: {
            code: 'PACK-CHANGED',
            barcode: 'LIVE-123',
            product: {
              id: 'product-1',
              nameEn: 'Paracetamol Renamed',
              nameAr: 'باراسيتامول محدث',
              tradeNameEn: 'Updated trade',
              tradeNameAr: 'اسم تجاري محدث',
              genericNameEn: 'Updated generic',
              genericNameAr: 'اسم عام محدث',
              strength: '650mg',
              packSize: '24 tabs',
              taxProfileCode: 'CHANGED_CODE',
              dosageForm: { nameEn: 'Caplet', nameAr: 'كابليت' },
            },
          },
          lotBatch: { batchNo: 'LIVE-B-1', expiryDate: new Date('2028-01-01T00:00:00.000Z') },
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
        transactionSnapshot: expect.objectContaining({
          displayNameEn: 'Paracetamol Snapshot',
          displayNameAr: 'باراسيتامول محفوظ',
          genericNameEn: 'Acetaminophen Snapshot',
          barcodeUsed: 'SNAP-123',
          sellableCode: 'PACK-SNAPSHOT',
          batchNo: 'SNAP-B-1',
        }),
      }),
    );
  });
});
