import 'reflect-metadata';
import { PurchaseOrderStatus } from '@prisma/client';
import { ProcurementMovementSource } from './dto/query-procurement-report.dto';
import { ProcurementReportsService } from './procurement-reports.service';

describe('ProcurementReportsService', () => {
  const prisma = {
    purchaseOrder: {
      findMany: jest.fn(),
    },
    inventoryMovement: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: ProcurementReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProcurementReportsService(prisma as never);
  });

  it('builds purchase order supplier/status/open totals', async () => {
    prisma.purchaseOrder.findMany.mockResolvedValueOnce([
      {
        id: 'po-1',
        poNumber: 'PO-2026-000001',
        status: PurchaseOrderStatus.APPROVED,
        orderedAt: new Date('2026-02-20T00:00:00.000Z'),
        supplierId: 'sup-1',
        supplier: {
          code: 'SUP-1',
          nameEn: 'Supplier One',
          nameAr: 'المورد 1',
        },
        lines: [
          { quantity: 10, receivedQuantity: 4, unitPrice: 5, lineTotal: 50 },
          { quantity: 2, receivedQuantity: 2, unitPrice: 10, lineTotal: 20 },
        ],
      },
    ]);

    const result = await service.getPurchaseOrdersSummary('tenant-1', {});
    expect(result.totals.orders).toBe(1);
    expect(result.totals.totalQuantity).toBe(12);
    expect(result.totals.totalValue).toBe(70);
    expect(result.totals.openQuantity).toBe(6);
    expect(result.totals.openValue).toBe(30);
    expect(result.statusCounts).toEqual([
      { status: PurchaseOrderStatus.APPROVED, count: 1 },
    ]);
    expect(result.supplierTotals[0].totalValue).toBe(70);
    expect(result.supplierTotals[0].openValue).toBe(30);
  });

  it('returns only requested movement source', async () => {
    prisma.$transaction.mockResolvedValueOnce([
      1,
      [
        {
          id: 'mv-1',
          movementType: 'OUT',
          quantity: -2,
          createdAt: new Date('2026-02-20T00:00:00.000Z'),
          branchId: 'branch-1',
          productId: 'product-1',
          branch: { name: 'Main Branch' },
          product: { nameEn: 'Prod', nameAr: 'منتج' },
          goodsReceiptLine: null,
          purchaseReturnLine: {
            purchaseReturn: {
              returnNumber: 'PRN-2026-000001',
              supplier: {
                id: 'sup-1',
                code: 'SUP-1',
                nameEn: 'Supplier One',
                nameAr: 'المورد 1',
              },
            },
          },
        },
      ],
    ]);

    const result = await service.getInventoryMovements('tenant-1', {
      source: ProcurementMovementSource.RETURN,
      page: 1,
      pageSize: 10,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].source).toBe(ProcurementMovementSource.RETURN);
    expect(result.rows[0].sourceDocumentNumber).toBe('PRN-2026-000001');
  });
});
