import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { ArService } from './ar.service';
import { ApplyArReceiptDto } from './dto/apply-ar-receipt.dto';
import { CreateArReceiptDto } from './dto/create-ar-receipt.dto';
import { QueryArAgingDto } from './dto/query-ar-aging.dto';
import { QueryArInvoicesDto } from './dto/query-ar-invoices.dto';

@Controller('ar')
export class ArController {
  constructor(private readonly arService: ArService) {}

  @Post('invoices/from-sales/:salesInvoiceId')
  @Permissions('ar.manage')
  createInvoiceFromSales(
    @Req() req: RequestWithContext,
    @Param('salesInvoiceId') salesInvoiceId: string,
  ) {
    return this.arService.createInvoiceFromSales(
      resolveTenantId(req),
      req.user,
      salesInvoiceId,
    );
  }

  @Get('invoices')
  @Permissions('ar.read')
  listInvoices(
    @Req() req: RequestWithContext,
    @Query() query: QueryArInvoicesDto,
  ) {
    return this.arService.listInvoices(resolveTenantId(req), query);
  }

  @Get('aging')
  @Permissions('ar.read')
  aging(@Req() req: RequestWithContext, @Query() query: QueryArAgingDto) {
    return this.arService.getAging(resolveTenantId(req), {
      ...query,
      asOf: query.asOf ?? (req.query.as_of_date as string | undefined),
    });
  }

  @Post('receipts')
  @Permissions('ar.manage')
  createReceipt(
    @Req() req: RequestWithContext,
    @Body() dto: CreateArReceiptDto,
  ) {
    return this.arService.createReceipt(resolveTenantId(req), req.user, dto);
  }

  @Post('receipts/:id/apply')
  @Permissions('ar.manage')
  applyReceipt(
    @Req() req: RequestWithContext,
    @Param('id') id: string,
    @Body() dto: ApplyArReceiptDto,
  ) {
    return this.arService.applyReceipt(resolveTenantId(req), id, dto);
  }

  @Post('receipts/:id/post')
  @Permissions('ar.manage')
  postReceipt(@Req() req: RequestWithContext, @Param('id') id: string) {
    return this.arService.postReceipt(resolveTenantId(req), id);
  }

  @Post('invoices/:id/void')
  @Permissions('ar.manage')
  voidInvoice(@Req() req: RequestWithContext, @Param('id') id: string) {
    return this.arService.voidInvoice(resolveTenantId(req), id);
  }
}
