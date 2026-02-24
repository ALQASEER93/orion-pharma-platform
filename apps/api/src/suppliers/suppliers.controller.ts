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
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Permissions('suppliers.read')
  list(@Req() request: RequestWithContext, @Query() query: QuerySuppliersDto) {
    return this.suppliersService.list(resolveTenantId(request), query);
  }

  @Post()
  @Permissions('suppliers.manage')
  create(@Req() request: RequestWithContext, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(resolveTenantId(request), dto);
  }

  @Patch(':id')
  @Permissions('suppliers.manage')
  update(
    @Req() request: RequestWithContext,
    @Param('id') supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(
      resolveTenantId(request),
      supplierId,
      dto,
    );
  }
}
