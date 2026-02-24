import { Injectable } from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  PurchaseOrderStatus,
} from '@prisma/client';
import { toCsv } from '../common/utils/csv.util';
import {
  ProcurementMovementSource,
  QueryProcurementReportDto,
} from './dto/query-procurement-report.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProcurementReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPurchaseOrdersSummary(
    tenantId: string,
    query: QueryProcurementReportDto,
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            orderedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const records = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        lines: true,
      },
      orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const rows = records.map((record) => {
      const totalQuantity = record.lines.reduce(
        (sum, line) => sum + line.quantity,
        0,
      );
      const totalValue = this.roundMoney(
        record.lines.reduce((sum, line) => sum + line.lineTotal, 0),
      );
      const openQuantity = record.lines.reduce(
        (sum, line) => sum + Math.max(line.quantity - line.receivedQuantity, 0),
        0,
      );
      const openValue = this.roundMoney(
        record.lines.reduce(
          (sum, line) =>
            sum +
            Math.max(line.quantity - line.receivedQuantity, 0) * line.unitPrice,
          0,
        ),
      );

      return {
        id: record.id,
        poNumber: record.poNumber,
        status: record.status,
        orderedAt: record.orderedAt.toISOString(),
        supplierId: record.supplierId,
        supplierCode: record.supplier.code,
        supplierNameEn: record.supplier.nameEn,
        supplierNameAr: record.supplier.nameAr,
        totalQuantity,
        totalValue,
        openQuantity,
        openValue,
      };
    });

    const statusCounts = this.aggregateStatusCounts(rows);
    const supplierTotals = this.aggregateSupplierTotals(rows);
    const totals = {
      orders: rows.length,
      totalQuantity: rows.reduce((sum, row) => sum + row.totalQuantity, 0),
      totalValue: this.roundMoney(
        rows.reduce((sum, row) => sum + row.totalValue, 0),
      ),
      openQuantity: rows.reduce((sum, row) => sum + row.openQuantity, 0),
      openValue: this.roundMoney(
        rows.reduce((sum, row) => sum + row.openValue, 0),
      ),
    };

    return {
      totals,
      statusCounts,
      supplierTotals,
      rows,
    };
  }

  async getGoodsReceiptsSummary(
    tenantId: string,
    query: QueryProcurementReportDto,
  ) {
    const where: Prisma.GoodsReceiptWhereInput = {
      tenantId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            receivedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const records = await this.prisma.goodsReceipt.findMany({
      where,
      include: {
        supplier: true,
        lines: {
          include: {
            purchaseOrderLine: {
              select: {
                unitPrice: true,
              },
            },
          },
        },
      },
      orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const rows = records.map((record) => {
      const totalQuantity = record.lines.reduce(
        (sum, line) => sum + line.qtyReceivedNow,
        0,
      );
      const totalValue = this.roundMoney(
        record.lines.reduce(
          (sum, line) =>
            sum + line.qtyReceivedNow * line.purchaseOrderLine.unitPrice,
          0,
        ),
      );

      return {
        id: record.id,
        grnNumber: record.grnNumber,
        receivedAt: record.receivedAt.toISOString(),
        supplierId: record.supplierId,
        supplierCode: record.supplier.code,
        supplierNameEn: record.supplier.nameEn,
        supplierNameAr: record.supplier.nameAr,
        totalQuantity,
        totalValue,
      };
    });

    return {
      totals: {
        receipts: rows.length,
        totalQuantity: rows.reduce((sum, row) => sum + row.totalQuantity, 0),
        totalValue: this.roundMoney(
          rows.reduce((sum, row) => sum + row.totalValue, 0),
        ),
      },
      supplierTotals: this.aggregateReceiptSupplierTotals(rows),
      rows,
    };
  }

  async getPurchaseReturnsSummary(
    tenantId: string,
    query: QueryProcurementReportDto,
  ) {
    const where: Prisma.PurchaseReturnWhereInput = {
      tenantId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            returnedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const records = await this.prisma.purchaseReturn.findMany({
      where,
      include: {
        supplier: true,
        lines: {
          include: {
            goodsReceiptLine: {
              include: {
                purchaseOrderLine: {
                  select: {
                    unitPrice: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ returnedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const rows = records.map((record) => {
      const totalQuantity = record.lines.reduce(
        (sum, line) => sum + line.qtyReturnedNow,
        0,
      );
      const totalValue = this.roundMoney(
        record.lines.reduce(
          (sum, line) =>
            sum +
            line.qtyReturnedNow *
              line.goodsReceiptLine.purchaseOrderLine.unitPrice,
          0,
        ),
      );

      return {
        id: record.id,
        returnNumber: record.returnNumber,
        returnedAt: record.returnedAt.toISOString(),
        supplierId: record.supplierId,
        supplierCode: record.supplier.code,
        supplierNameEn: record.supplier.nameEn,
        supplierNameAr: record.supplier.nameAr,
        totalQuantity,
        totalValue,
      };
    });

    return {
      totals: {
        returns: rows.length,
        totalQuantity: rows.reduce((sum, row) => sum + row.totalQuantity, 0),
        totalValue: this.roundMoney(
          rows.reduce((sum, row) => sum + row.totalValue, 0),
        ),
      },
      supplierTotals: this.aggregateReceiptSupplierTotals(rows),
      rows,
    };
  }

  async getInventoryMovements(
    tenantId: string,
    query: QueryProcurementReportDto,
  ) {
    const page = this.toPositiveInt(query.page, 1);
    const pageSize = this.toPositiveInt(query.pageSize, 50);
    const skip = (page - 1) * pageSize;

    const sourceFilter = this.buildMovementSourceFilter(query);
    const supplierFilter = this.buildMovementSupplierFilter(query);

    const where: Prisma.InventoryMovementWhereInput = {
      tenantId,
      movementType: {
        in: [InventoryMovementType.IN, InventoryMovementType.OUT],
      },
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(sourceFilter ? { AND: [sourceFilter] } : {}),
      ...(supplierFilter ? { AND: [supplierFilter] } : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          branch: true,
          product: true,
          goodsReceiptLine: {
            include: {
              goodsReceipt: {
                include: {
                  supplier: true,
                },
              },
            },
          },
          purchaseReturnLine: {
            include: {
              purchaseReturn: {
                include: {
                  supplier: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const rows = records.map((record) => {
      const isGrn = Boolean(record.goodsReceiptLine);
      const source = isGrn
        ? ProcurementMovementSource.GRN
        : ProcurementMovementSource.RETURN;
      const sourceDoc = isGrn
        ? (record.goodsReceiptLine?.goodsReceipt.grnNumber ?? null)
        : (record.purchaseReturnLine?.purchaseReturn.returnNumber ?? null);
      const supplier = isGrn
        ? record.goodsReceiptLine?.goodsReceipt.supplier
        : record.purchaseReturnLine?.purchaseReturn.supplier;

      return {
        id: record.id,
        movementType: record.movementType,
        quantity: record.quantity,
        source,
        sourceDocumentNumber: sourceDoc,
        movementAt: record.createdAt.toISOString(),
        branchId: record.branchId,
        branchName: record.branch.name,
        productId: record.productId,
        productNameEn: record.product.nameEn,
        productNameAr: record.product.nameAr,
        supplierId: supplier?.id ?? null,
        supplierCode: supplier?.code ?? null,
        supplierNameEn: supplier?.nameEn ?? null,
        supplierNameAr: supplier?.nameAr ?? null,
      };
    });

    return {
      pagination: {
        page,
        pageSize,
        total,
      },
      totals: {
        movementCount: total,
        totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      },
      rows,
    };
  }

  toPurchaseOrdersCsv(
    data: Awaited<
      ReturnType<ProcurementReportsService['getPurchaseOrdersSummary']>
    >,
  ) {
    return toCsv(
      [
        'poNumber',
        'orderedAt',
        'status',
        'supplierCode',
        'supplierNameEn',
        'totalQuantity',
        'totalValue',
        'openQuantity',
        'openValue',
      ],
      data.rows.map((row) => [
        row.poNumber,
        row.orderedAt,
        row.status,
        row.supplierCode,
        row.supplierNameEn,
        row.totalQuantity,
        row.totalValue,
        row.openQuantity,
        row.openValue,
      ]),
    );
  }

  toGoodsReceiptsCsv(
    data: Awaited<
      ReturnType<ProcurementReportsService['getGoodsReceiptsSummary']>
    >,
  ) {
    return toCsv(
      [
        'grnNumber',
        'receivedAt',
        'supplierCode',
        'supplierNameEn',
        'totalQuantity',
        'totalValue',
      ],
      data.rows.map((row) => [
        row.grnNumber,
        row.receivedAt,
        row.supplierCode,
        row.supplierNameEn,
        row.totalQuantity,
        row.totalValue,
      ]),
    );
  }

  toPurchaseReturnsCsv(
    data: Awaited<
      ReturnType<ProcurementReportsService['getPurchaseReturnsSummary']>
    >,
  ) {
    return toCsv(
      [
        'returnNumber',
        'returnedAt',
        'supplierCode',
        'supplierNameEn',
        'totalQuantity',
        'totalValue',
      ],
      data.rows.map((row) => [
        row.returnNumber,
        row.returnedAt,
        row.supplierCode,
        row.supplierNameEn,
        row.totalQuantity,
        row.totalValue,
      ]),
    );
  }

  private aggregateStatusCounts(rows: Array<{ status: PurchaseOrderStatus }>) {
    const counts = new Map<PurchaseOrderStatus, number>();
    for (const row of rows) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }

    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  }

  private aggregateSupplierTotals(
    rows: Array<{
      supplierId: string;
      supplierCode: string;
      supplierNameEn: string;
      supplierNameAr: string;
      totalValue: number;
      openQuantity: number;
      openValue: number;
    }>,
  ) {
    const grouped = new Map<
      string,
      {
        supplierId: string;
        supplierCode: string;
        supplierNameEn: string;
        supplierNameAr: string;
        orderCount: number;
        totalValue: number;
        openQuantity: number;
        openValue: number;
      }
    >();

    for (const row of rows) {
      const current = grouped.get(row.supplierId) ?? {
        supplierId: row.supplierId,
        supplierCode: row.supplierCode,
        supplierNameEn: row.supplierNameEn,
        supplierNameAr: row.supplierNameAr,
        orderCount: 0,
        totalValue: 0,
        openQuantity: 0,
        openValue: 0,
      };

      current.orderCount += 1;
      current.totalValue = this.roundMoney(current.totalValue + row.totalValue);
      current.openQuantity += row.openQuantity;
      current.openValue = this.roundMoney(current.openValue + row.openValue);
      grouped.set(row.supplierId, current);
    }

    return [...grouped.values()];
  }

  private aggregateReceiptSupplierTotals(
    rows: Array<{
      supplierId: string;
      supplierCode: string;
      supplierNameEn: string;
      supplierNameAr: string;
      totalQuantity: number;
      totalValue: number;
    }>,
  ) {
    const grouped = new Map<
      string,
      {
        supplierId: string;
        supplierCode: string;
        supplierNameEn: string;
        supplierNameAr: string;
        documents: number;
        totalQuantity: number;
        totalValue: number;
      }
    >();

    for (const row of rows) {
      const current = grouped.get(row.supplierId) ?? {
        supplierId: row.supplierId,
        supplierCode: row.supplierCode,
        supplierNameEn: row.supplierNameEn,
        supplierNameAr: row.supplierNameAr,
        documents: 0,
        totalQuantity: 0,
        totalValue: 0,
      };

      current.documents += 1;
      current.totalQuantity += row.totalQuantity;
      current.totalValue = this.roundMoney(current.totalValue + row.totalValue);
      grouped.set(row.supplierId, current);
    }

    return [...grouped.values()];
  }

  private buildMovementSourceFilter(query: QueryProcurementReportDto) {
    if (query.source === ProcurementMovementSource.GRN) {
      return {
        goodsReceiptLine: { isNot: null },
      } satisfies Prisma.InventoryMovementWhereInput;
    }

    if (query.source === ProcurementMovementSource.RETURN) {
      return {
        purchaseReturnLine: { isNot: null },
      } satisfies Prisma.InventoryMovementWhereInput;
    }

    return {
      OR: [
        { goodsReceiptLine: { isNot: null } },
        { purchaseReturnLine: { isNot: null } },
      ],
    } satisfies Prisma.InventoryMovementWhereInput;
  }

  private buildMovementSupplierFilter(query: QueryProcurementReportDto) {
    if (!query.supplierId) {
      return null;
    }

    return {
      OR: [
        {
          goodsReceiptLine: {
            is: {
              goodsReceipt: {
                supplierId: query.supplierId,
              },
            },
          },
        },
        {
          purchaseReturnLine: {
            is: {
              purchaseReturn: {
                supplierId: query.supplierId,
              },
            },
          },
        },
      ],
    } satisfies Prisma.InventoryMovementWhereInput;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toPositiveInt(value: number | string | undefined, fallback: number) {
    if (value === undefined || value === null) {
      return fallback;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
