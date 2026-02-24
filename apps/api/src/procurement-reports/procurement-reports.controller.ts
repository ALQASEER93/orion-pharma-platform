import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { QueryProcurementReportDto } from './dto/query-procurement-report.dto';
import { ProcurementReportsService } from './procurement-reports.service';

@Controller('reports/procurement')
export class ProcurementReportsController {
  constructor(
    private readonly procurementReportsService: ProcurementReportsService,
  ) {}

  @Get('purchase-orders')
  @Permissions('purchase_orders.read')
  getPurchaseOrders(
    @Req() request: RequestWithContext,
    @Query() query: QueryProcurementReportDto,
  ) {
    return this.procurementReportsService.getPurchaseOrdersSummary(
      resolveTenantId(request),
      query,
    );
  }

  @Get('purchase-orders.csv')
  @Permissions('purchase_orders.read')
  async getPurchaseOrdersCsv(
    @Req() request: RequestWithContext,
    @Query() query: QueryProcurementReportDto,
    @Res() response: Response,
  ) {
    const payload =
      await this.procurementReportsService.getPurchaseOrdersSummary(
        resolveTenantId(request),
        query,
      );

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="purchase-orders-report.csv"',
    );
    return response.send(
      this.procurementReportsService.toPurchaseOrdersCsv(payload),
    );
  }

  @Get('goods-receipts')
  @Permissions('goods_receipts.read')
  getGoodsReceipts(
    @Req() request: RequestWithContext,
    @Query() query: QueryProcurementReportDto,
  ) {
    return this.procurementReportsService.getGoodsReceiptsSummary(
      resolveTenantId(request),
      query,
    );
  }

  @Get('goods-receipts.csv')
  @Permissions('goods_receipts.read')
  async getGoodsReceiptsCsv(
    @Req() request: RequestWithContext,
    @Query() query: QueryProcurementReportDto,
    @Res() response: Response,
  ) {
    const payload =
      await this.procurementReportsService.getGoodsReceiptsSummary(
        resolveTenantId(request),
        query,
      );

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="goods-receipts-report.csv"',
    );
    return response.send(
      this.procurementReportsService.toGoodsReceiptsCsv(payload),
    );
  }

  @Get('purchase-returns')
  @Permissions('purchase_returns.read')
  getPurchaseReturns(
    @Req() request: RequestWithContext,
    @Query() query: QueryProcurementReportDto,
  ) {
    return this.procurementReportsService.getPurchaseReturnsSummary(
      resolveTenantId(request),
      query,
    );
  }

  @Get('purchase-returns.csv')
  @Permissions('purchase_returns.read')
  async getPurchaseReturnsCsv(
    @Req() request: RequestWithContext,
    @Query() query: QueryProcurementReportDto,
    @Res() response: Response,
  ) {
    const payload =
      await this.procurementReportsService.getPurchaseReturnsSummary(
        resolveTenantId(request),
        query,
      );

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="purchase-returns-report.csv"',
    );
    return response.send(
      this.procurementReportsService.toPurchaseReturnsCsv(payload),
    );
  }

  @Get('inventory-movements')
  @Permissions('inventory.read')
  getInventoryMovements(
    @Req() request: RequestWithContext,
    @Query() query: QueryProcurementReportDto,
  ) {
    return this.procurementReportsService.getInventoryMovements(
      resolveTenantId(request),
      query,
    );
  }
}
