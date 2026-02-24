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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions('customers.read')
  list(@Req() request: RequestWithContext, @Query() query: QueryCustomersDto) {
    return this.customersService.list(resolveTenantId(request), query);
  }

  @Post()
  @Permissions('customers.manage')
  create(@Req() request: RequestWithContext, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(resolveTenantId(request), dto);
  }

  @Get(':id')
  @Permissions('customers.read')
  detail(@Req() request: RequestWithContext, @Param('id') customerId: string) {
    return this.customersService.detail(resolveTenantId(request), customerId);
  }

  @Patch(':id')
  @Permissions('customers.manage')
  update(
    @Req() request: RequestWithContext,
    @Param('id') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(
      resolveTenantId(request),
      customerId,
      dto,
    );
  }
}
