import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductWorkspaceController } from './product-workspace.controller';
import { ProductWorkspaceService } from './product-workspace.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController, ProductWorkspaceController],
  providers: [ProductsService, ProductWorkspaceService],
  exports: [ProductsService, ProductWorkspaceService],
})
export class ProductsModule {}
