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
import { AccountingService } from './accounting.service';
import { ClosePeriodDto } from './dto/close-period.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreatePostingRuleDto } from './dto/create-posting-rule.dto';
import { CreatePostingRuleSetDto } from './dto/create-posting-ruleset.dto';
import { QueryJournalsDto } from './dto/query-journals.dto';
import { ListReconciliationRunsDto } from './dto/list-reconciliation-runs.dto';
import { QueryPeriodReportDto } from './dto/query-period-report.dto';
import { QueryPostingRulesDto } from './dto/query-posting-rules.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { RunReconciliationDto } from './dto/run-reconciliation.dto';
import { SimulatePostingRulesDto } from './dto/simulate-posting-rules.dto';
import { UpdatePostingRuleDto } from './dto/update-posting-rule.dto';
import { UpdatePostingRuleSetDto } from './dto/update-posting-ruleset.dto';
import { StatementType } from '@prisma/client';

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

  @Get('posting-rulesets')
  @Permissions('accounting.read')
  listPostingRuleSets(@Req() req: RequestWithContext) {
    return this.accountingService.listPostingRuleSets(resolveTenantId(req));
  }

  @Post('posting-rulesets')
  @Permissions('accounting.manage')
  createPostingRuleSet(
    @Req() req: RequestWithContext,
    @Body() dto: CreatePostingRuleSetDto,
  ) {
    return this.accountingService.createPostingRuleSet(
      resolveTenantId(req),
      req.user?.sub,
      dto,
    );
  }

  @Patch('posting-rulesets/:id')
  @Permissions('accounting.manage')
  updatePostingRuleSet(
    @Req() req: RequestWithContext,
    @Param('id') id: string,
    @Body() dto: UpdatePostingRuleSetDto,
  ) {
    return this.accountingService.updatePostingRuleSet(
      resolveTenantId(req),
      id,
      dto,
    );
  }

  @Get('posting-rules')
  @Permissions('accounting.read')
  listPostingRules(
    @Req() req: RequestWithContext,
    @Query() query: QueryPostingRulesDto,
  ) {
    return this.accountingService.listPostingRules(resolveTenantId(req), query);
  }

  @Post('posting-rules')
  @Permissions('accounting.manage')
  createPostingRule(
    @Req() req: RequestWithContext,
    @Body() dto: CreatePostingRuleDto,
  ) {
    return this.accountingService.createPostingRule(resolveTenantId(req), dto);
  }

  @Patch('posting-rules/:id')
  @Permissions('accounting.manage')
  updatePostingRule(
    @Req() req: RequestWithContext,
    @Param('id') id: string,
    @Body() dto: UpdatePostingRuleDto,
  ) {
    return this.accountingService.updatePostingRule(
      resolveTenantId(req),
      id,
      dto,
    );
  }

  @Post('posting-rules/simulate')
  @Permissions('accounting.manage')
  simulatePostingRules(
    @Req() req: RequestWithContext,
    @Body() dto: SimulatePostingRulesDto,
  ) {
    return this.accountingService.simulatePostingRules(
      resolveTenantId(req),
      dto,
    );
  }

  @Post('periods/:id/close')
  @Permissions('accounting.manage')
  closePeriod(
    @Req() req: RequestWithContext,
    @Param('id') id: string,
    @Body() dto: ClosePeriodDto,
  ) {
    return this.accountingService.closePeriod(
      resolveTenantId(req),
      id,
      req.user?.sub,
      dto.notes,
    );
  }

  @Post('periods/:id/reopen')
  @Permissions('accounting.manage')
  reopenPeriod(
    @Req() req: RequestWithContext,
    @Param('id') id: string,
    @Body() dto: ReopenPeriodDto,
  ) {
    return this.accountingService.reopenPeriod(
      resolveTenantId(req),
      id,
      req.user?.sub,
      dto,
    );
  }

  @Get('trial-balance')
  @Permissions('accounting.read')
  getTrialBalance(
    @Req() req: RequestWithContext,
    @Query() query: QueryPeriodReportDto,
  ) {
    return this.accountingService.getTrialBalanceSnapshot(
      resolveTenantId(req),
      query,
    );
  }

  @Get('statements/pl')
  @Permissions('accounting.read')
  getPlStatement(
    @Req() req: RequestWithContext,
    @Query() query: QueryPeriodReportDto,
  ) {
    return this.accountingService.getStatementSnapshot(
      resolveTenantId(req),
      query,
      StatementType.PL,
    );
  }

  @Get('statements/bs')
  @Permissions('accounting.read')
  getBsStatement(
    @Req() req: RequestWithContext,
    @Query() query: QueryPeriodReportDto,
  ) {
    return this.accountingService.getStatementSnapshot(
      resolveTenantId(req),
      query,
      StatementType.BS,
    );
  }

  @Post('reconciliation/run')
  @Permissions('accounting.manage')
  runReconciliation(
    @Req() req: RequestWithContext,
    @Query() query: RunReconciliationDto,
  ) {
    return this.accountingService.runReconciliation(resolveTenantId(req), {
      ...query,
      asOf: query.asOf ?? (req.query.as_of_date as string | undefined),
      createdByUserId: req.user?.sub,
    });
  }

  @Get('reconciliation/runs')
  @Permissions('accounting.read')
  listReconciliationRuns(
    @Req() req: RequestWithContext,
    @Query() query: ListReconciliationRunsDto,
  ) {
    return this.accountingService.listReconciliationRuns(
      resolveTenantId(req),
      query,
    );
  }

  @Get('reconciliation/runs/:id')
  @Permissions('accounting.read')
  getReconciliationRun(
    @Req() req: RequestWithContext,
    @Param('id') id: string,
  ) {
    return this.accountingService.getReconciliationRun(
      resolveTenantId(req),
      id,
    );
  }
}
