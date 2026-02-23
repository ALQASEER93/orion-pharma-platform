import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { resolveTenantId } from '../common/utils/tenant.util';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock-on-hand')
  @Permissions('inventory.read')
  getStockOnHand(
    @Req() request: RequestWithContext,
    @Query() query: QueryStockDto,
  ) {
    return this.inventoryService.getStockOnHand(
      resolveTenantId(request),
      query,
    );
  }

  @Post('movements')
  @Permissions('inventory.adjust')
  addMovement(
    @Req() request: RequestWithContext,
    @Body() dto: CreateInventoryMovementDto,
  ) {
    return this.inventoryService.addMovement(
      resolveTenantId(request),
      request.user,
      dto,
    );
  }
}
