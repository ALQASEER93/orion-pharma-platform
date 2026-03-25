import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LegalEntitiesFoundationService } from './legal-entities-foundation.service';
import { RegistersFoundationService } from './registers-foundation.service';
import { ProductPacksFoundationService } from './product-packs-foundation.service';
import { LotBatchesFoundationService } from './lot-batches-foundation.service';

@Module({
  imports: [PrismaModule],
  providers: [
    LegalEntitiesFoundationService,
    RegistersFoundationService,
    ProductPacksFoundationService,
    LotBatchesFoundationService,
  ],
  exports: [
    LegalEntitiesFoundationService,
    RegistersFoundationService,
    ProductPacksFoundationService,
    LotBatchesFoundationService,
  ],
})
export class InventoryFiscalFoundationModule {}

