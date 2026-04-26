import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryLedgerService } from './inventory-ledger.service';

@Module({
  imports: [PrismaModule],
  providers: [InventoryLedgerService],
  exports: [InventoryLedgerService],
})
export class InventoryLedgerModule {}
