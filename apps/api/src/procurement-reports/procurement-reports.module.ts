import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProcurementReportsController } from './procurement-reports.controller';
import { ProcurementReportsService } from './procurement-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProcurementReportsController],
  providers: [ProcurementReportsService],
})
export class ProcurementReportsModule {}
