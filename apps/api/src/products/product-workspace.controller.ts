import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../common/types/request-with-context.type';
import { resolveTenantId } from '../common/utils/tenant.util';
import { ApplyProductWorkspaceFlagsDto } from './dto/apply-product-workspace-flags.dto';
import { ApplyProductWorkspaceApprovalDto } from './dto/apply-product-workspace-approval.dto';
import { ApplyProductWorkspaceMergeDecisionsDto } from './dto/apply-product-workspace-merge-decisions.dto';
import { CreateProductWorkspaceWorklistDto } from './dto/create-product-workspace-worklist.dto';
import { CreateProductWorkspaceHandoffDto } from './dto/create-product-workspace-handoff.dto';
import { ProductWorkspaceConcurrencyDto } from './dto/product-workspace-concurrency.dto';
import { ProductWorkspacePromotionExecutionDto } from './dto/promotion-execution.dto';
import { UpdateProductWorkspaceDraftDto } from './dto/update-product-workspace-draft.dto';
import { ProductWorkspaceService } from './product-workspace.service';

@Controller('products/workspace')
export class ProductWorkspaceController {
  constructor(
    private readonly productWorkspaceService: ProductWorkspaceService,
  ) {}

  @Get()
  @Permissions('products.read')
  getWorkspace(@Req() request: RequestWithContext) {
    return this.productWorkspaceService.getWorkspace(resolveTenantId(request));
  }

  @Patch('draft')
  @Permissions('products.manage')
  updateDraft(
    @Req() request: RequestWithContext,
    @Body() dto: UpdateProductWorkspaceDraftDto,
  ) {
    return this.productWorkspaceService.updateDraft(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('draft/promote')
  @Permissions('products.manage')
  promoteDraft(
    @Req() request: RequestWithContext,
    @Body() dto: ProductWorkspacePromotionExecutionDto = {},
  ) {
    return this.productWorkspaceService.promoteDraft(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('draft/activate')
  @Permissions('products.manage')
  activateDraft(
    @Req() request: RequestWithContext,
    @Body() dto: ProductWorkspaceConcurrencyDto = {},
  ) {
    return this.productWorkspaceService.activateDraft(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('draft/deactivate')
  @Permissions('products.manage')
  deactivateDraft(
    @Req() request: RequestWithContext,
    @Body() dto: ProductWorkspaceConcurrencyDto = {},
  ) {
    return this.productWorkspaceService.deactivateDraft(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('draft/reset')
  @Permissions('products.manage')
  resetDraft(
    @Req() request: RequestWithContext,
    @Body() dto: ProductWorkspaceConcurrencyDto = {},
  ) {
    return this.productWorkspaceService.resetDraft(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('draft/merge-decisions')
  @Permissions('products.manage')
  applyMergeDecisions(
    @Req() request: RequestWithContext,
    @Body() dto: ApplyProductWorkspaceMergeDecisionsDto,
  ) {
    return this.productWorkspaceService.applyMergeDecisions(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('draft/approval')
  @Permissions('products.manage')
  applyApprovalDecision(
    @Req() request: RequestWithContext,
    @Body() dto: ApplyProductWorkspaceApprovalDto,
  ) {
    return this.productWorkspaceService.applyApprovalDecision(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('draft/handoff')
  @Permissions('products.manage')
  packageHandoff(
    @Req() request: RequestWithContext,
    @Body() dto: CreateProductWorkspaceHandoffDto,
  ) {
    return this.productWorkspaceService.packageHandoff(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('flags')
  @Permissions('products.manage')
  applyFlags(
    @Req() request: RequestWithContext,
    @Body() dto: ApplyProductWorkspaceFlagsDto,
  ) {
    return this.productWorkspaceService.applyFlags(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Post('worklists')
  @Permissions('products.manage')
  createWorklist(
    @Req() request: RequestWithContext,
    @Body() dto: CreateProductWorkspaceWorklistDto,
  ) {
    return this.productWorkspaceService.createWorklist(
      resolveTenantId(request),
      request.user?.sub ?? null,
      dto,
    );
  }

  @Delete('worklists/:id')
  @Permissions('products.manage')
  deleteWorklist(
    @Req() request: RequestWithContext,
    @Param('id') worklistId: string,
  ) {
    return this.productWorkspaceService.deleteWorklist(
      resolveTenantId(request),
      request.user?.sub ?? null,
      worklistId,
    );
  }
}
