import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FiscalDocumentsService } from './fiscal-documents.service';

@Module({
  imports: [PrismaModule],
  providers: [FiscalDocumentsService],
  exports: [FiscalDocumentsService],
})
export class FiscalDocumentsModule {}
