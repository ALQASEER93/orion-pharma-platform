import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { AccountingService } from './accounting.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { QueryJournalsDto } from './dto/query-journals.dto';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('coa')
  @Permissions('accounting.read')
  listCoa(@Req() req: RequestWithContext) {
    return this.accountingService.listCoa(resolveTenantId(req));
  }

  @Post('coa/seed-default')
  @Permissions('accounting.manage')
  seedDefaultCoa(@Req() req: RequestWithContext) {
    return this.accountingService.seedDefaultCoa(resolveTenantId(req));
  }

  @Post('journals')
  @Permissions('accounting.manage')
  createJournal(@Req() req: RequestWithContext, @Body() dto: CreateJournalDto) {
    return this.accountingService.createJournal(resolveTenantId(req), dto);
  }

  @Get('journals')
  @Permissions('accounting.read')
  listJournals(
    @Req() req: RequestWithContext,
    @Query() query: QueryJournalsDto,
  ) {
    return this.accountingService.listJournals(resolveTenantId(req), query);
  }

  @Post('journals/:id/post')
  @Permissions('accounting.manage')
  postJournal(@Req() req: RequestWithContext, @Param('id') id: string) {
    return this.accountingService.postJournal(resolveTenantId(req), id);
  }
}
