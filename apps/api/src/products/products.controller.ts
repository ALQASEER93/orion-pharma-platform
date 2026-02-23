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
}
