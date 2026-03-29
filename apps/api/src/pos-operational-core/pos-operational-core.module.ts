import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PosOperationalCoreService } from './pos-operational-core.service';

@Module({
  imports: [PrismaModule],
  providers: [PosOperationalCoreService],
  exports: [PosOperationalCoreService],
})
export class PosOperationalCoreModule {}
