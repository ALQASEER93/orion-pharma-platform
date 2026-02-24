import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { QueryGoodsReceiptsDto } from './dto/query-goods-receipts.dto';
import { GoodsReceiptsService } from './goods-receipts.service';

@Controller('goods-receipts')
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Get()
  @Permissions('goods_receipts.read')
  list(
    @Req() request: RequestWithContext,
    @Query() query: QueryGoodsReceiptsDto,
  ) {
    return this.goodsReceiptsService.list(resolveTenantId(request), query);
  }

  @Post()
  @Permissions('goods_receipts.manage')
  create(
    @Req() request: RequestWithContext,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.goodsReceiptsService.create(
      resolveTenantId(request),
      request.user,
      dto,
    );
  }
}
