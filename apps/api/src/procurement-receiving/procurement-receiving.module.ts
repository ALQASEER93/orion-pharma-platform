import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProcurementReceivingService } from './procurement-receiving.service';

@Module({
  imports: [PrismaModule],
  providers: [ProcurementReceivingService],
  exports: [ProcurementReceivingService],
})
export class ProcurementReceivingModule {}
