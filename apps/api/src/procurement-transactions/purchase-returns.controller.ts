import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { ProcurementTransactionsService } from './procurement-transactions.service';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { QueryPurchaseReturnsDto } from './dto/query-purchase-returns.dto';

@Controller('purchase-returns')
export class PurchaseReturnsController {
  constructor(
    private readonly procurementTransactionsService: ProcurementTransactionsService,
  ) {}

  @Get()
  @Permissions('purchase_returns.read')
  list(
    @Req() request: RequestWithContext,
    @Query() query: QueryPurchaseReturnsDto,
  ) {
    return this.procurementTransactionsService.listPurchaseReturns(
      resolveTenantId(request),
      query,
    );
  }

  @Post()
  @Permissions('purchase_returns.manage')
  create(
    @Req() request: RequestWithContext,
    @Body() dto: CreatePurchaseReturnDto,
  ) {
    return this.procurementTransactionsService.createPurchaseReturn(
      resolveTenantId(request),
      request.user,
      dto,
    );
  }
}
