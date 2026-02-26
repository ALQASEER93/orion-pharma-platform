import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryValuationService } from './inventory-valuation.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryValuationService],
  exports: [InventoryValuationService],
})
export class InventoryModule {}
