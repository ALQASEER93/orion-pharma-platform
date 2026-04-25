import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { resolveTenantId } from '../common/utils/tenant.util';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { SaveProductMaintenanceDto } from './dto/save-product-maintenance.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions('products.read')
  list(@Req() request: RequestWithContext, @Query() query: QueryProductsDto) {
    return this.productsService.list(resolveTenantId(request), query);
  }

  @Post()
  @Permissions('products.manage')
  create(@Req() request: RequestWithContext, @Body() dto: CreateProductDto) {
    return this.productsService.create(resolveTenantId(request), dto);
  }

  @Post('maintenance')
  @Permissions('products.manage')
  saveMaintenanceRecord(
    @Req() request: RequestWithContext,
    @Body() dto: SaveProductMaintenanceDto,
  ) {
    return this.productsService.saveMaintenanceRecord(
      resolveTenantId(request),
      dto,
      request.user?.sub ?? null,
    );
  }

  @Patch(':id')
  @Permissions('products.manage')
  update(
    @Req() request: RequestWithContext,
    @Param('id') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(
      resolveTenantId(request),
      productId,
      dto,
    );
  }

  @Patch(':id/maintenance')
  @Permissions('products.manage')
  updateMaintenanceRecord(
    @Req() request: RequestWithContext,
    @Param('id') productId: string,
    @Body() dto: SaveProductMaintenanceDto,
  ) {
    return this.productsService.saveMaintenanceRecord(
      resolveTenantId(request),
      dto,
      request.user?.sub ?? null,
      productId,
    );
  }
}
