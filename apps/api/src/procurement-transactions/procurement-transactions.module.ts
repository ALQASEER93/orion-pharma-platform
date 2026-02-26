import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryAdjustmentsController } from './inventory-adjustments.controller';
import { ProcurementAdjustmentsController } from './procurement-adjustments.controller';
import { ProcurementTransactionsService } from './procurement-transactions.service';
import { PurchaseReturnsController } from './purchase-returns.controller';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [
    PurchaseReturnsController,
    ProcurementAdjustmentsController,
    InventoryAdjustmentsController,
  ],
  providers: [ProcurementTransactionsService],
})
export class ProcurementTransactionsModule {}
