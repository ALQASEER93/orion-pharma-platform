import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [ArController],
  providers: [ArService],
})
export class ArModule {}
