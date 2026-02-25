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
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreatePostingRuleDto } from './dto/create-posting-rule.dto';
import { CreatePostingRuleSetDto } from './dto/create-posting-ruleset.dto';
import { QueryJournalsDto } from './dto/query-journals.dto';
import { QueryPostingRulesDto } from './dto/query-posting-rules.dto';
import { SimulatePostingRulesDto } from './dto/simulate-posting-rules.dto';
import { UpdatePostingRuleDto } from './dto/update-posting-rule.dto';
import { UpdatePostingRuleSetDto } from './dto/update-posting-ruleset.dto';

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
}
