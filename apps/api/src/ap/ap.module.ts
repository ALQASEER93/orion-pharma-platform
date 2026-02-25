import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ApController } from './ap.controller';
import { ApService } from './ap.service';

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [ApController],
  providers: [ApService],
})
export class ApModule {}
