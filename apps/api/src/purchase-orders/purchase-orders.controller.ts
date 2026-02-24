import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @Permissions('purchase_orders.read')
  list(
    @Req() request: RequestWithContext,
    @Query() query: QueryPurchaseOrdersDto,
  ) {
    return this.purchaseOrdersService.list(resolveTenantId(request), query);
  }

  @Get(':id')
  @Permissions('purchase_orders.read')
  detail(
    @Req() request: RequestWithContext,
    @Param('id') purchaseOrderId: string,
  ) {
    return this.purchaseOrdersService.detail(
      resolveTenantId(request),
      purchaseOrderId,
    );
  }

  @Post()
  @Permissions('purchase_orders.manage')
  create(
    @Req() request: RequestWithContext,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.create(resolveTenantId(request), dto);
  }
}
