import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingController } from './accounting.controller';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingService } from './accounting.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingPostingService],
})
export class AccountingModule {}
