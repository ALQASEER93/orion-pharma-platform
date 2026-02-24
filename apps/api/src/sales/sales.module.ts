import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [PrismaModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
