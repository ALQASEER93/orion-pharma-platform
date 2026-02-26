import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { CreateSalesInvoiceLineDto } from './dto/create-sales-invoice-line.dto';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
import { QuerySalesInvoicesDto } from './dto/query-sales-invoices.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { UpdateSalesInvoiceLineDto } from './dto/update-sales-invoice-line.dto';
import { SalesService } from './sales.service';

@Controller()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('sales/invoices')
  @Permissions('sales_invoices.read')
  listInvoices(
    @Req() request: RequestWithContext,
    @Query() query: QuerySalesInvoicesDto,
  ) {
    return this.salesService.listInvoices(resolveTenantId(request), query);
  }

  @Post('sales/invoices')
  @Permissions('sales_invoices.manage')
  createDraft(
    @Req() request: RequestWithContext,
    @Body() dto: CreateSalesInvoiceDto,
  ) {
    return this.salesService.createDraft(
      resolveTenantId(request),
      request.user,
      dto,
    );
  }

  @Get('sales/invoices/:id')
  @Permissions('sales_invoices.read')
  detailInvoice(
    @Req() request: RequestWithContext,
    @Param('id') invoiceId: string,
  ) {
    return this.salesService.detailInvoice(resolveTenantId(request), invoiceId);
  }

  @Patch('sales/invoices/:id')
  @Permissions('sales_invoices.manage')
  updateHeader(
    @Req() request: RequestWithContext,
    @Param('id') invoiceId: string,
    @Body() dto: UpdateSalesInvoiceDto,
  ) {
    return this.salesService.updateHeader(
      resolveTenantId(request),
      invoiceId,
      dto,
    );
  }

  @Post('sales/invoices/:id/lines')
  @Permissions('sales_invoices.manage')
  addLine(
    @Req() request: RequestWithContext,
    @Param('id') invoiceId: string,
    @Body() dto: CreateSalesInvoiceLineDto,
  ) {
    return this.salesService.addLine(resolveTenantId(request), invoiceId, dto);
  }

  @Patch('sales/invoices/:id/lines/:lineId')
  @Permissions('sales_invoices.manage')
  updateLine(
    @Req() request: RequestWithContext,
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateSalesInvoiceLineDto,
  ) {
    return this.salesService.updateLine(
      resolveTenantId(request),
      invoiceId,
      lineId,
      dto,
    );
  }

  @Delete('sales/invoices/:id/lines/:lineId')
  @Permissions('sales_invoices.manage')
  deleteLine(
    @Req() request: RequestWithContext,
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.salesService.deleteLine(
      resolveTenantId(request),
      invoiceId,
      lineId,
    );
  }

  @Post('sales/invoices/:id/post')
  @Permissions('sales_invoices.manage')
  postInvoice(
    @Req() request: RequestWithContext,
    @Param('id') invoiceId: string,
  ) {
    return this.salesService.postInvoice(
      resolveTenantId(request),
      request.user,
      invoiceId,
    );
  }

  @Post('sales/invoices/:id/post-cogs')
  @Permissions('sales_invoices.manage')
  postCogs(@Req() request: RequestWithContext, @Param('id') invoiceId: string) {
    return this.salesService.postCogs(resolveTenantId(request), invoiceId);
  }

  @Post('pos/checkout')
  @Permissions('pos.checkout')
  checkout(@Req() request: RequestWithContext, @Body() dto: PosCheckoutDto) {
    return this.salesService.checkout(
      resolveTenantId(request),
      request.user,
      dto,
    );
  }
}
