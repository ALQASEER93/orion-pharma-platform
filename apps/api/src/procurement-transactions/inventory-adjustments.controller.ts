import { Body, Controller, Post, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { CreateProcurementAdjustmentDto } from './dto/create-procurement-adjustment.dto';
import { ProcurementTransactionsService } from './procurement-transactions.service';

@Controller('inventory-adjustments')
export class InventoryAdjustmentsController {
  constructor(
    private readonly procurementTransactionsService: ProcurementTransactionsService,
  ) {}

  @Post()
  @Permissions('inventory_adjustments.manage')
  create(
    @Req() request: RequestWithContext,
    @Body() dto: CreateProcurementAdjustmentDto,
  ) {
    return this.procurementTransactionsService.createProcurementAdjustment(
      resolveTenantId(request),
      request.user,
      dto,
    );
  }
}
