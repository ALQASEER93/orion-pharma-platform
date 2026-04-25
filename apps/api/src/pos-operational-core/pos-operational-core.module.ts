import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PosOperationalCoreController } from './pos-operational-core.controller';
import { PosOperationalCoreService } from './pos-operational-core.service';

@Module({
  imports: [PrismaModule],
  controllers: [PosOperationalCoreController],
  providers: [PosOperationalCoreService],
  exports: [PosOperationalCoreService],
})
export class PosOperationalCoreModule {}
