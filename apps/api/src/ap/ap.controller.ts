import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { ApService } from './ap.service';
import { ApplyApPaymentDto } from './dto/apply-ap-payment.dto';
import { CreateApBillDto } from './dto/create-ap-bill.dto';
import { CreateApPaymentDto } from './dto/create-ap-payment.dto';
import { QueryApAgingDto } from './dto/query-ap-aging.dto';
import { QueryApBillsDto } from './dto/query-ap-bills.dto';

@Controller('ap')
export class ApController {
  constructor(private readonly apService: ApService) {}

  @Post('bills')
  @Permissions('ap.manage')
  createBill(@Req() req: RequestWithContext, @Body() dto: CreateApBillDto) {
    return this.apService.createBill(resolveTenantId(req), req.user, dto);
  }

  @Get('bills')
  @Permissions('ap.read')
  listBills(@Req() req: RequestWithContext, @Query() query: QueryApBillsDto) {
    return this.apService.listBills(resolveTenantId(req), query);
  }

  @Get('aging')
  @Permissions('ap.read')
  aging(@Req() req: RequestWithContext, @Query() query: QueryApAgingDto) {
    return this.apService.getAging(resolveTenantId(req), {
      ...query,
      asOf: query.asOf ?? (req.query.as_of_date as string | undefined),
    });
  }

  @Post('payments')
  @Permissions('ap.manage')
  createPayment(
    @Req() req: RequestWithContext,
    @Body() dto: CreateApPaymentDto,
  ) {
    return this.apService.createPayment(resolveTenantId(req), req.user, dto);
  }

  @Post('payments/:id/apply')
  @Permissions('ap.manage')
  applyPayment(
    @Req() req: RequestWithContext,
    @Param('id') id: string,
    @Body() dto: ApplyApPaymentDto,
  ) {
    return this.apService.applyPayment(resolveTenantId(req), id, dto);
  }

  @Post('payments/:id/post')
  @Permissions('ap.manage')
  postPayment(@Req() req: RequestWithContext, @Param('id') id: string) {
    return this.apService.postPayment(resolveTenantId(req), id);
  }

  @Post('bills/:id/void')
  @Permissions('ap.manage')
  voidBill(@Req() req: RequestWithContext, @Param('id') id: string) {
    return this.apService.voidBill(resolveTenantId(req), id);
  }
}
