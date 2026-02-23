import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { resolveTenantId } from '../common/utils/tenant.util';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { CreateTaxonomyItemDto } from './dto/create-taxonomy-item.dto';
import { TaxonomyService } from './taxonomy.service';

@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get(':type')
  @Permissions('products.read')
  list(
    @Req() request: RequestWithContext,
    @Param('type')
    type:
      | 'therapeutic_classes'
      | 'dosage_forms'
      | 'storage_conditions'
      | 'regulatory_types',
  ) {
    return this.taxonomyService.list(resolveTenantId(request), type);
  }

  @Post()
  @Permissions('products.manage')
  create(
    @Req() request: RequestWithContext,
    @Body() dto: CreateTaxonomyItemDto,
  ) {
    return this.taxonomyService.create(resolveTenantId(request), dto);
  }
}
