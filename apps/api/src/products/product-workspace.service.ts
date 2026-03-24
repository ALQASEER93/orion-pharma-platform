import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductWorkspaceRecordKind,
  TrackingMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApplyProductWorkspaceFlagsDto,
  ProductWorkspaceFlagAction,
} from './dto/apply-product-workspace-flags.dto';
import {
  ApplyProductWorkspaceApprovalDto,
  ProductWorkspaceApprovalDecision,
} from './dto/apply-product-workspace-approval.dto';
import {
  ApplyProductWorkspaceMergeDecisionsDto,
  ProductWorkspaceMergeDecision,
} from './dto/apply-product-workspace-merge-decisions.dto';
import {
  CreateProductWorkspaceHandoffDto,
  ProductWorkspaceHandoffExpectedDecision,
} from './dto/create-product-workspace-handoff.dto';
import { CreateProductWorkspaceWorklistDto } from './dto/create-product-workspace-worklist.dto';
import { ProductWorkspaceConcurrencyDto } from './dto/product-workspace-concurrency.dto';
import {
  ProductWorkspacePromotionExecutionDto,
  ProductWorkspacePromotionFieldKey,
  ProductWorkspacePromotionMode,
  ProductWorkspacePromotionPlanDto,
  ProductWorkspacePromotionSource,
  ProductWorkspacePromotionTargetState,
  productWorkspacePromotionFieldKeys,
} from './dto/promotion-execution.dto';
import { UpdateProductWorkspaceDraftDto } from './dto/update-product-workspace-draft.dto';

const DRAFT_RECORD_ID = 'draft';
const ACTIVE_TRACEABILITY_NEXT_STEP =
  'Keep active or return the draft to planning mode before editing';
const ACTIVE_HANDOFF_NEXT_STEP =
  'Keep active or deactivate to return to planning mode before editing';
const ACTIVE_MERGE_TRACEABILITY_SUMMARY =
  'Catalog product is already active. Reference merge traceability is retained from the promoted snapshot.';
const ACTIVE_APPROVAL_TRACEABILITY_SUMMARY =
  'Catalog product is already active. Approval traceability is retained from the promoted snapshot.';
const ACTIVE_PROMOTION_CONFIRMATION_STATE =
  'Catalog product is already active. Promotion remains recorded for traceability.';
const ACTIVE_ACTIVATION_CHANGED_STATE =
  'Activation is already completed and the catalog product remains active.';

type DraftStatus =
  | 'EMPTY'
  | 'INCOMPLETE'
  | 'REVIEWABLE'
  | 'READY_TO_PROMOTE'
  | 'PROMOTED_INACTIVE'
  | 'PROMOTED_ACTIVE';

type DraftSnapshot = {
  id: string;
  tenantId: string;
  nameAr: string;
  nameEn: string;
  barcode: string;
  strength: string;
  packSize: string;
  trackingMode: TrackingMode;
  catalogProductId: string | null;
  basedOnProductId: string | null;
  lastPromotedAt: Date | null;
  lastActivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProductSnapshot = {
  id: string;
  tenantId: string;
  nameAr: string;
  nameEn: string;
  barcode: string;
  strength: string;
  packSize: string;
  trackingMode: TrackingMode;
  isActive: boolean;
  updatedAt: Date;
};

type WorkspaceClient = PrismaService | Prisma.TransactionClient;

type DuplicateBarcodeConflict = {
  barcode: string;
  conflictingProductId: string;
  conflictingProductName: string;
  conflictingProductStatus: 'ACTIVE' | 'INACTIVE';
  conflictingProductUpdatedAt: string;
};

type WorkspaceConflictActor = {
  userId: string | null;
  email: string | null;
  changedAt: string;
};

type MergeDecisionField =
  | 'nameAr'
  | 'nameEn'
  | 'barcode'
  | 'strength'
  | 'packSize'
  | 'trackingMode';

type MergeDecisionSummary = {
  diffs: Array<{
    field: MergeDecisionField;
    label: string;
    referenceValue: string;
    draftValue: string;
    decision: ProductWorkspaceMergeDecision | null;
  }>;
  hasDifferences: boolean;
  referenceRecordKey: string | null;
  decisionSetAt: string | null;
  decidedBy: string | null;
  rationale: string | null;
  pendingCount: number;
  applyDraftCount: number;
  keepReferenceCount: number;
  operatorSummary: string;
  nextStep: string;
  draftUpdatedAt: string;
  basedOnProductId: string | null;
};

type ApprovalSummary = {
  required: boolean;
  status:
    | 'NOT_REQUIRED'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'CHANGES_REQUESTED';
  lastDecision: {
    decision: ProductWorkspaceApprovalDecision;
    decisionLabel: string;
    decidedAt: string;
    decidedBy: string | null;
    note: string | null;
  } | null;
  operatorSummary: string;
  nextStep: string;
};

type HandoffSummary = {
  ready: boolean;
  packagedAt: string | null;
  packagedBy: string | null;
  summary: string;
  changed: string[];
  pending: string[];
  blockers: string[];
  expectedDecision: ProductWorkspaceHandoffExpectedDecision;
  nextStep: string;
};

type WorkspaceRecoverySummary = {
  retrySafe: boolean;
  refreshRequired: boolean;
  reopenRequired: boolean;
  rollbackMode: 'NON_DESTRUCTIVE';
  unchangedState: string;
  guidance: string;
};

type LocalizedMessage = {
  en: string;
  ar: string;
};

type ActivationSummaryMessageContract = {
  currentState: LocalizedMessage;
  pendingState: LocalizedMessage;
  changedState: LocalizedMessage;
  nextStep: LocalizedMessage;
};

type WorkspaceMessageContract = {
  activationReady?: LocalizedMessage;
  activationBlocked?: LocalizedMessage;
  alreadyActive?: LocalizedMessage;
  staleConflictRejection?: LocalizedMessage;
  recoveryGuidance?: LocalizedMessage;
  mergeSummary?: LocalizedMessage;
  approvalSummary?: LocalizedMessage;
  handoffSummary?: LocalizedMessage;
  activationSummary?: ActivationSummaryMessageContract;
};

type PromotionPlanItem = {
  fieldKey: ProductWorkspacePromotionFieldKey;
  label: string;
  source: ProductWorkspacePromotionSource;
  value: string;
};

type PromotionExecutionPlan = {
  mode: ProductWorkspacePromotionMode;
  targetState: ProductWorkspacePromotionTargetState;
  items: PromotionPlanItem[];
  summary: string;
  nextStep: string;
};

type PromotionConfirmation = {
  promotedAt: string;
  promotedBy: string | null;
  promotedProductId: string | null;
  basedOnProductId: string | null;
  mode: ProductWorkspacePromotionMode;
  targetState: ProductWorkspacePromotionTargetState;
  items: PromotionPlanItem[];
  changed: string[];
  activeState: string;
  referenceState: string;
  finalState: string;
  summary: string;
  nextStep: string;
};

type PromotionSummary = {
  ready: boolean;
  operatorSummary: string;
  nextStep: string;
  executionPlan: PromotionExecutionPlan;
  confirmation: PromotionConfirmation | null;
};

type ActivationConfirmation = {
  activatedAt: string;
  activatedBy: string | null;
  activatedProductId: string | null;
  basedOnProductId: string | null;
  currentState: string;
  pendingState: string;
  changedState: string;
  finalState: string;
  summary: string;
  nextStep: string;
};

type ActivationSummary = {
  ready: boolean;
  operatorSummary: string;
  nextStep: string;
  currentState: string;
  pendingState: string;
  changedState: string;
  confirmation: ActivationConfirmation | null;
};

type WorkspaceAuditEntry = {
  id: string;
  action: string;
  after: Prisma.JsonValue | null;
  createdAt: Date;
  user?: {
    email: string;
  } | null;
};

type MergeDecisionAuditSnapshot = {
  decisions: Partial<Record<MergeDecisionField, ProductWorkspaceMergeDecision>>;
  decisionSetAt: string;
  decidedBy: string | null;
  rationale: string | null;
  draftUpdatedAt: string | null;
  basedOnProductId: string | null;
};

type ApprovalAuditSnapshot = {
  decision: ProductWorkspaceApprovalDecision;
  decisionLabel: string;
  decidedAt: string;
  decidedBy: string | null;
  note: string | null;
  draftUpdatedAt: string | null;
  basedOnProductId: string | null;
};

type PromotionAuditSnapshot = {
  promotedAt: string;
  promotedBy: string | null;
  promotedProductId: string | null;
  basedOnProductId: string | null;
  mode: ProductWorkspacePromotionMode;
  targetState: ProductWorkspacePromotionTargetState;
  items: PromotionPlanItem[];
  changed: string[];
  activeState: string;
  referenceState: string;
  finalState: string;
  summary: string;
  nextStep: string;
};

type ActivationAuditSnapshot = {
  activatedAt: string;
  activatedBy: string | null;
  activatedProductId: string | null;
  basedOnProductId: string | null;
  currentState: string;
  pendingState: string;
  changedState: string;
  finalState: string;
  summary: string;
  nextStep: string;
};

const draftFieldLabels = {
  nameAr: 'Add Name (AR)',
  nameEn: 'Add Name (EN)',
  strength: 'Add strength',
  packSize: 'Add pack',
  barcode: 'Capture barcode',
} as const;

const editableDraftFields = [
  'nameAr',
  'nameEn',
  'barcode',
  'strength',
  'packSize',
  'trackingMode',
] as const;

const mergeDecisionFields = [
  'nameAr',
  'nameEn',
  'barcode',
  'strength',
  'packSize',
  'trackingMode',
] as const satisfies readonly MergeDecisionField[];

const mergeDecisionFieldLabels: Record<MergeDecisionField, string> = {
  nameAr: 'Name (AR)',
  nameEn: 'Name (EN)',
  barcode: 'Barcode',
  strength: 'Strength',
  packSize: 'Pack',
  trackingMode: 'Tracking',
};

@Injectable()
export class ProductWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspace(tenantId: string) {
    return this.loadWorkspace(this.prisma, tenantId);
  }

  async updateDraft(
    tenantId: string,
    userId: string | null,
    dto: UpdateProductWorkspaceDraftDto,
  ) {
    const existing = await this.ensureDraft(this.prisma, tenantId);
    if (existing.catalogProductId) {
      throw new BadRequestException(
        'Return the working draft to planning mode before changing details.',
      );
    }

    const updateData = this.buildDraftUpdateData(dto);
    if (Object.keys(updateData).length === 0) {
      return {
        draft: this.toDraftPayload(existing, null, null, null),
      };
    }

    const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
      dto.expectedDraftUpdatedAt,
      'save draft changes',
    );
    await this.assertDraftVersionMatches({
      client: this.prisma,
      tenantId,
      userId,
      expectedUpdatedAt: expectedDraftUpdatedAt,
      draft: existing,
      actionLabel: 'save draft changes',
    });

    const allowedProductId =
      existing.catalogProductId ?? existing.basedOnProductId;
    const effectiveBarcode =
      typeof updateData.barcode === 'string'
        ? updateData.barcode
        : existing.barcode;
    const barcodeConflict = await this.findDuplicateBarcodeConflict(
      this.prisma,
      tenantId,
      effectiveBarcode,
      allowedProductId,
    );
    if (barcodeConflict) {
      throw this.buildDuplicateBarcodeConflict(
        barcodeConflict,
        'save draft changes',
      );
    }

    const updateResult = await this.prisma.productWorkspaceDraft.updateMany({
      where: {
        tenantId,
        updatedAt: expectedDraftUpdatedAt,
      },
      data: updateData,
    });
    if (updateResult.count !== 1) {
      const latestDraft = await this.ensureDraft(this.prisma, tenantId);
      throw await this.buildStaleDraftConflict({
        client: this.prisma,
        tenantId,
        userId,
        draftId: latestDraft.id,
        currentUpdatedAt: latestDraft.updatedAt,
        actionLabel: 'save draft changes',
      });
    }

    const updated = await this.ensureDraft(this.prisma, tenantId);
    const basedOnProduct = await this.findTenantProductById(
      this.prisma,
      tenantId,
      updated.basedOnProductId,
    );
    const payloadBarcodeConflict = await this.findDuplicateBarcodeConflict(
      this.prisma,
      tenantId,
      updated.barcode,
      updated.catalogProductId ?? updated.basedOnProductId,
    );

    if (userId && this.didCreateMeaningfulDraft(dto)) {
      await this.writeAuditLog(this.prisma, {
        tenantId,
        userId,
        action: 'products.workspace.draft.saved',
        entity: 'product_workspace_draft',
        entityId: updated.id,
        after: {
          historyLabel: 'Saved working draft',
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'Server-backed draft details were updated for this tenant.',
        },
      });
    }

    return {
      draft: this.toDraftPayload(
        updated,
        null,
        basedOnProduct,
        payloadBarcodeConflict,
      ),
    };
  }

  async promoteDraft(
    tenantId: string,
    userId: string | null,
    dto: ProductWorkspacePromotionExecutionDto = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'move the working draft into catalog',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'move the working draft into catalog',
      });

      if (draft.catalogProductId) {
        throw new BadRequestException(
          'Working draft is already in catalog. Activate, deactivate, or return it to planning mode first.',
        );
      }

      const targetProduct =
        draft.basedOnProductId == null
          ? null
          : await tx.product.findFirst({
              where: { id: draft.basedOnProductId, tenantId },
              select: {
                id: true,
                tenantId: true,
                nameAr: true,
                nameEn: true,
                barcode: true,
                strength: true,
                packSize: true,
                trackingMode: true,
                isActive: true,
                updatedAt: true,
              },
            });
      await this.assertLinkedProductVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAtRaw: dto.expectedBasedOnUpdatedAt,
        product: targetProduct,
        actionLabel: 'move the working draft into catalog',
      });

      const latestMergeDecision = targetProduct
        ? await this.findLatestMergeDecision(tx, tenantId, draft.id)
        : null;
      const mergeSummary = targetProduct
        ? this.resolveMergeDecisionSummary(
            draft,
            targetProduct,
            latestMergeDecision,
          )
        : null;
      const latestApproval = targetProduct
        ? await this.findLatestApprovalDecision(tx, tenantId, draft.id)
        : null;
      const approvalSummary = this.resolveApprovalSummary(
        mergeSummary,
        latestApproval,
      );
      const promotionPlan = this.buildPromotionExecutionPlan(
        draft,
        targetProduct,
        mergeSummary,
      );

      if (!dto.confirmed || !dto.plan) {
        throw this.buildPromotionExecutionConflict({
          plan: promotionPlan,
          actionLabel: 'move the working draft into catalog',
          conflictType: 'PROMOTION_EXECUTION_REQUIRED',
          message: 'Promotion requires an explicit, confirmed execution plan.',
          operatorSummary:
            'Review the exact promotion plan, confirm the field sources, then retry.',
          nextSteps: [
            'Open the promotion execution controls.',
            'Confirm the promoted field values and sources.',
            'Retry the promotion with the confirmed plan.',
          ],
          recovery: {
            retrySafe: true,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog record changed because the promotion was not confirmed.',
            guidance:
              'No rollback is required. Confirm the execution plan and retry.',
          },
        });
      }

      if (!this.isPromotionPlanAligned(dto.plan, promotionPlan)) {
        throw this.buildPromotionExecutionConflict({
          plan: promotionPlan,
          actionLabel: 'move the working draft into catalog',
          conflictType: 'PROMOTION_PLAN_STALE',
          message:
            'The confirmed promotion plan no longer matches the current workspace state.',
          operatorSummary:
            'Refresh the workspace, review the current plan, and confirm the updated field values before retrying.',
          nextSteps: [
            'Refresh the workspace to load the current server plan.',
            'Review the field values and sources again.',
            'Confirm the updated plan and retry the promotion.',
          ],
          recovery: {
            retrySafe: true,
            refreshRequired: true,
            reopenRequired: true,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog record changed because the confirmed plan was stale.',
            guidance:
              'No destructive rollback occurred. Refresh, reopen the workspace if needed, and confirm the new plan.',
          },
        });
      }

      const barcodeConflict = await this.findDuplicateBarcodeConflict(
        tx,
        tenantId,
        draft.barcode,
        targetProduct?.id ?? null,
      );
      const readiness = this.toDraftPayload(
        draft,
        null,
        targetProduct,
        barcodeConflict,
      ).readiness;
      if (!readiness.canPromote) {
        throw this.buildPromotionExecutionConflict({
          plan: promotionPlan,
          actionLabel: 'move the working draft into catalog',
          conflictType: 'PROMOTION_PREREQUISITES_NOT_MET',
          message: 'Working draft is not ready for catalog yet.',
          operatorSummary: readiness.operatorSummary,
          nextSteps: readiness.missingForCatalog.length
            ? readiness.missingForCatalog.map(
                (item) => `Complete ${item.toLowerCase()} before retrying.`,
              )
            : [
                'Complete the missing catalog requirements.',
                'Refresh the workspace if the draft changed elsewhere.',
              ],
          recovery: {
            retrySafe: true,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog record changed because the draft was not ready.',
            guidance:
              'No rollback is required. Complete the missing requirements and retry.',
          },
        });
      }
      if (barcodeConflict) {
        throw this.buildDuplicateBarcodeConflict(
          barcodeConflict,
          'move the working draft into catalog',
        );
      }

      if (
        mergeSummary &&
        mergeSummary.hasDifferences &&
        mergeSummary.pendingCount > 0
      ) {
        throw this.buildPromotionExecutionConflict({
          plan: promotionPlan,
          actionLabel: 'move the working draft into catalog',
          conflictType: 'MERGE_DECISIONS_REQUIRED',
          message:
            'Merge cannot continue until every changed field has an explicit decision.',
          operatorSummary:
            'Review differences first, then decide whether each changed field should use draft or keep reference.',
          nextSteps: [
            'Open the merge decisions panel in products workspace.',
            'Set a decision for every changed field.',
            'Retry moving the draft into catalog.',
          ],
          recovery: {
            retrySafe: true,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog record changed because merge decisions are still pending.',
            guidance:
              'No rollback is required. Complete the merge decisions and retry.',
          },
        });
      }

      if (approvalSummary.required && approvalSummary.status !== 'APPROVED') {
        throw this.buildPromotionExecutionConflict({
          plan: promotionPlan,
          actionLabel: 'move the working draft into catalog',
          conflictType: 'APPROVAL_REQUIRED',
          message:
            'Merge approval is required before catalog merge can proceed.',
          operatorSummary:
            'Reference-linked draft changes need an explicit approval decision before merge.',
          nextSteps: [
            'Record a review decision in the approval section.',
            'Approve the merge package when it is ready.',
            'Retry moving the draft into catalog.',
          ],
          recovery: {
            retrySafe: true,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog record changed because approval is still pending.',
            guidance:
              'No rollback is required. Approve the merge package and retry.',
          },
        });
      }
      const promotedValues = this.resolvePromoteValues(
        draft,
        targetProduct,
        mergeSummary,
      );

      let productId = targetProduct?.id ?? null;
      try {
        if (targetProduct) {
          const updatedProduct = await tx.product.updateMany({
            where: {
              id: targetProduct.id,
              tenantId,
              updatedAt: targetProduct.updatedAt,
            },
            data: {
              nameAr: promotedValues.nameAr,
              nameEn: promotedValues.nameEn,
              barcode: promotedValues.barcode,
              strength: promotedValues.strength,
              packSize: promotedValues.packSize,
              trackingMode: promotedValues.trackingMode,
              isActive: false,
            },
          });
          if (updatedProduct.count !== 1) {
            throw await this.buildStaleLinkedProductConflict({
              client: tx,
              tenantId,
              userId,
              productId: targetProduct.id,
              actionLabel: 'move the working draft into catalog',
            });
          }
        } else {
          const created = await tx.product.create({
            data: {
              tenantId,
              nameAr: promotedValues.nameAr,
              nameEn: promotedValues.nameEn,
              barcode: promotedValues.barcode,
              strength: promotedValues.strength,
              packSize: promotedValues.packSize,
              trackingMode: promotedValues.trackingMode,
              isActive: false,
            },
            select: { id: true },
          });
          productId = created.id;
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const message =
            'Barcode already belongs to another product in this tenant.';
          const recovery = {
            retrySafe: true,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE' as const,
            unchangedState:
              'No catalog change was committed because the barcode already exists elsewhere in this tenant.',
            guidance:
              'Choose a different barcode or open the existing product if that is the intended reference.',
          };
          throw new ConflictException({
            message,
            conflictType: 'DUPLICATE_BARCODE',
            blockedAction: 'move the working draft into catalog',
            operatorSummary:
              'The barcode in the promotion payload already belongs to another product in this tenant.',
            nextSteps: [
              'Choose a different barcode for the working draft.',
              'Open the existing product if that barcode is the intended reference.',
              'Retry promotion after the barcode conflict is resolved.',
            ],
            recovery,
            messageContract: this.buildConflictMessageContract({
              conflictType: 'DUPLICATE_BARCODE',
              message,
              recovery,
            }),
          });
        }
        throw error;
      }

      const now = new Date();
      const updatedDraft = await tx.productWorkspaceDraft.updateMany({
        where: {
          tenantId,
          updatedAt: expectedDraftUpdatedAt,
        },
        data: {
          catalogProductId: productId,
          basedOnProductId: productId,
          lastPromotedAt: now,
          nameAr: promotedValues.nameAr,
          nameEn: promotedValues.nameEn,
          barcode: promotedValues.barcode,
          strength: promotedValues.strength,
          packSize: promotedValues.packSize,
          trackingMode: promotedValues.trackingMode,
        },
      });
      if (updatedDraft.count !== 1) {
        throw await this.buildStaleDraftConflict({
          client: tx,
          tenantId,
          userId,
          draftId: draft.id,
          currentUpdatedAt: (await this.ensureDraft(tx, tenantId)).updatedAt,
          actionLabel: 'move the working draft into catalog',
        });
      }

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.draft.promoted',
        entity: 'product_workspace_draft',
        entityId: draft.id,
        after: {
          historyLabel: 'Moved working draft into catalog',
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'The server validated the confirmed promotion plan and saved the product as catalog listed.',
          productId,
          mergeDecisionPendingCount: mergeSummary?.pendingCount ?? 0,
          mergeApplyDraftCount: mergeSummary?.applyDraftCount ?? 0,
          mergeKeepReferenceCount: mergeSummary?.keepReferenceCount ?? 0,
          approvalStatus: approvalSummary.status,
          promotion: this.buildPromotionAuditSnapshot({
            targetProduct,
            mergeSummary,
            promotionPlan,
            promotedAt: now,
            promotedProductId: productId,
          }),
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async activateDraft(
    tenantId: string,
    userId: string | null,
    dto: ProductWorkspaceConcurrencyDto = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'activate the catalog product',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'activate the catalog product',
      });

      if (!draft.catalogProductId) {
        throw this.buildActivationExecutionConflict({
          conflictType: 'ACTIVATION_PREREQUISITES_NOT_MET',
          message: 'Move the working draft into catalog before activation.',
          operatorSummary:
            'Activation is blocked until the draft is catalog listed.',
          nextSteps: [
            'Move the working draft into catalog first.',
            'Retry activation after the catalog product is ready.',
          ],
          recovery: {
            retrySafe: true,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog change was committed because the draft is not catalog listed yet.',
            guidance:
              'Promote the draft first, then retry activation once the catalog product exists.',
          },
        });
      }

      const product = await tx.product.findFirst({
        where: { id: draft.catalogProductId, tenantId },
        select: {
          id: true,
          isActive: true,
          tenantId: true,
          nameAr: true,
          nameEn: true,
          barcode: true,
          strength: true,
          packSize: true,
          trackingMode: true,
          updatedAt: true,
        },
      });
      if (!product) {
        throw new NotFoundException(
          'Catalog product not found for this tenant.',
        );
      }
      if (product.isActive) {
        throw this.buildActivationExecutionConflict({
          conflictType: 'ACTIVATION_ALREADY_EXECUTED',
          message: 'Catalog product is already active.',
          operatorSummary:
            'The catalog product is already active, so activation is no longer needed.',
          nextSteps: [
            'Deactivate the catalog product if you need to change launch state.',
            'Refresh the workspace if the active state may be stale.',
          ],
          recovery: {
            retrySafe: false,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog change was committed because the product is already active.',
            guidance:
              'Use deactivate if you need to move the catalog product back to inactive.',
          },
        });
      }
      await this.assertLinkedProductVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAtRaw: dto.expectedCatalogUpdatedAt,
        product,
        actionLabel: 'activate the catalog product',
      });

      const readiness = this.toDraftPayload(
        draft,
        product,
        product,
        null,
      ).readiness;
      if (!readiness.canActivate) {
        throw this.buildActivationExecutionConflict({
          conflictType: 'ACTIVATION_PREREQUISITES_NOT_MET',
          message:
            'Working draft cannot activate until it is catalog listed and complete.',
          operatorSummary:
            'Activation is blocked until the catalog-listed product is ready for launch.',
          nextSteps: [
            'Complete the missing catalog requirements.',
            'Retry activation after refreshing the workspace if the state changed elsewhere.',
          ],
          recovery: {
            retrySafe: true,
            refreshRequired: false,
            reopenRequired: false,
            rollbackMode: 'NON_DESTRUCTIVE',
            unchangedState:
              'No catalog change was committed because the activation prerequisites were not met.',
            guidance:
              'Promote the draft first, then retry activation once the catalog product is ready.',
          },
        });
      }

      const now = new Date();
      const updatedProduct = await tx.product.updateMany({
        where: {
          id: product.id,
          tenantId,
          updatedAt: product.updatedAt,
        },
        data: { isActive: true },
      });
      if (updatedProduct.count !== 1) {
        throw await this.buildStaleLinkedProductConflict({
          client: tx,
          tenantId,
          userId,
          productId: product.id,
          actionLabel: 'activate the catalog product',
        });
      }
      const updatedDraft = await tx.productWorkspaceDraft.updateMany({
        where: {
          tenantId,
          updatedAt: expectedDraftUpdatedAt,
        },
        data: { lastActivatedAt: now },
      });
      if (updatedDraft.count !== 1) {
        throw await this.buildStaleDraftConflict({
          client: tx,
          tenantId,
          userId,
          draftId: draft.id,
          currentUpdatedAt: (await this.ensureDraft(tx, tenantId)).updatedAt,
          actionLabel: 'activate the catalog product',
        });
      }

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.draft.activated',
        entity: 'product_workspace_draft',
        entityId: draft.id,
        after: {
          historyLabel: 'Activated catalog product',
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'The catalog-listed product was activated after the readiness gate passed.',
          productId: product.id,
          activation: this.buildActivationAuditSnapshot({
            product,
            draft,
            activatedAt: now,
          }),
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async deactivateDraft(
    tenantId: string,
    userId: string | null,
    dto: ProductWorkspaceConcurrencyDto = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'deactivate the catalog product',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'deactivate the catalog product',
      });

      if (!draft.catalogProductId) {
        throw new BadRequestException(
          'Move the working draft into catalog before deactivation.',
        );
      }

      const product = await tx.product.findFirst({
        where: { id: draft.catalogProductId, tenantId },
        select: {
          id: true,
          tenantId: true,
          nameAr: true,
          nameEn: true,
          barcode: true,
          strength: true,
          packSize: true,
          trackingMode: true,
          isActive: true,
          updatedAt: true,
        },
      });
      if (!product) {
        throw new NotFoundException(
          'Catalog product not found for this tenant.',
        );
      }
      if (!product.isActive) {
        throw new BadRequestException('Catalog product is already inactive.');
      }
      await this.assertLinkedProductVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAtRaw: dto.expectedCatalogUpdatedAt,
        product,
        actionLabel: 'deactivate the catalog product',
      });

      const updatedProduct = await tx.product.updateMany({
        where: {
          id: product.id,
          tenantId,
          updatedAt: product.updatedAt,
        },
        data: { isActive: false },
      });
      if (updatedProduct.count !== 1) {
        throw await this.buildStaleLinkedProductConflict({
          client: tx,
          tenantId,
          userId,
          productId: product.id,
          actionLabel: 'deactivate the catalog product',
        });
      }

      const touchedDraft = await tx.productWorkspaceDraft.updateMany({
        where: {
          tenantId,
          updatedAt: expectedDraftUpdatedAt,
        },
        data: {
          basedOnProductId: draft.basedOnProductId,
        },
      });
      if (touchedDraft.count !== 1) {
        throw await this.buildStaleDraftConflict({
          client: tx,
          tenantId,
          userId,
          draftId: draft.id,
          currentUpdatedAt: (await this.ensureDraft(tx, tenantId)).updatedAt,
          actionLabel: 'deactivate the catalog product',
        });
      }

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.draft.deactivated',
        entity: 'product_workspace_draft',
        entityId: draft.id,
        after: {
          historyLabel: 'Deactivated catalog product',
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'The catalog product was moved out of active state without losing tenant history.',
          productId: product.id,
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async resetDraft(
    tenantId: string,
    userId: string | null,
    dto: ProductWorkspaceConcurrencyDto = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'return the draft to planning mode',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'return the draft to planning mode',
      });

      const linkedProduct =
        draft.catalogProductId == null
          ? null
          : await this.findTenantProductById(
              tx,
              tenantId,
              draft.catalogProductId,
            );
      await this.assertLinkedProductVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAtRaw: dto.expectedCatalogUpdatedAt,
        product: linkedProduct,
        actionLabel: 'return the draft to planning mode',
      });
      const basedOnProductId = draft.catalogProductId ?? draft.basedOnProductId;

      const updatedDraft = await tx.productWorkspaceDraft.updateMany({
        where: {
          tenantId,
          updatedAt: expectedDraftUpdatedAt,
        },
        data: {
          catalogProductId: null,
          basedOnProductId,
        },
      });
      if (updatedDraft.count !== 1) {
        throw await this.buildStaleDraftConflict({
          client: tx,
          tenantId,
          userId,
          draftId: draft.id,
          currentUpdatedAt: (await this.ensureDraft(tx, tenantId)).updatedAt,
          actionLabel: 'return the draft to planning mode',
        });
      }

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.draft.reset',
        entity: 'product_workspace_draft',
        entityId: draft.id,
        after: {
          historyLabel: 'Returned working draft to planning mode',
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'Catalog linkage was removed so the working draft can be edited safely again.',
          basedOnProductId,
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async applyMergeDecisions(
    tenantId: string,
    userId: string | null,
    dto: ApplyProductWorkspaceMergeDecisionsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'record merge decisions',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'record merge decisions',
      });

      const basedOnProduct = await this.findTenantProductById(
        tx,
        tenantId,
        draft.basedOnProductId,
      );
      await this.assertLinkedProductVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAtRaw: dto.expectedBasedOnUpdatedAt,
        product: basedOnProduct,
        actionLabel: 'record merge decisions',
      });
      if (!basedOnProduct) {
        throw new BadRequestException(
          'Open a reference product before recording merge decisions.',
        );
      }

      const currentDecision = await this.findLatestMergeDecision(
        tx,
        tenantId,
        draft.id,
      );
      const mergeSummary = this.resolveMergeDecisionSummary(
        draft,
        basedOnProduct,
        currentDecision,
      );
      if (!mergeSummary.hasDifferences) {
        throw new BadRequestException(
          'No merge decisions are needed because draft and reference are already aligned.',
        );
      }

      const decisions = this.normalizeMergeDecisions(
        dto.decisions,
        mergeSummary.diffs.map((diff) => diff.field),
      );

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.merge.decided',
        entity: 'product_workspace_draft',
        entityId: draft.id,
        after: {
          historyLabel: 'Recorded merge decisions against reference',
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'Merge decisions now explicitly define what will merge from working draft and what stays from reference.',
          mergeDecision: {
            decisions,
            rationale: dto.rationale?.trim() ?? null,
            draftUpdatedAt: draft.updatedAt.toISOString(),
            basedOnProductId: basedOnProduct.id,
            basedOnUpdatedAt: basedOnProduct.updatedAt.toISOString(),
          },
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async applyApprovalDecision(
    tenantId: string,
    userId: string | null,
    dto: ApplyProductWorkspaceApprovalDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'record approval decision',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'record approval decision',
      });

      const basedOnProduct = await this.findTenantProductById(
        tx,
        tenantId,
        draft.basedOnProductId,
      );
      await this.assertLinkedProductVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAtRaw: dto.expectedBasedOnUpdatedAt,
        product: basedOnProduct,
        actionLabel: 'record approval decision',
      });
      if (!basedOnProduct) {
        throw new BadRequestException(
          'Approval tracking is available when the draft is based on a reference product.',
        );
      }

      const latestMergeDecision = await this.findLatestMergeDecision(
        tx,
        tenantId,
        draft.id,
      );
      const mergeSummary = this.resolveMergeDecisionSummary(
        draft,
        basedOnProduct,
        latestMergeDecision,
      );
      if (
        mergeSummary.hasDifferences &&
        mergeSummary.pendingCount > 0 &&
        dto.decision !== ProductWorkspaceApprovalDecision.REJECTED &&
        dto.decision !== ProductWorkspaceApprovalDecision.REQUEST_CHANGES
      ) {
        const message =
          'Approval cannot proceed until merge decisions are completed for every changed field.';
        const operatorSummary =
          'Complete merge decisions first so approval is based on deterministic merge outcomes.';
        throw new ConflictException({
          message,
          conflictType: 'MERGE_DECISIONS_REQUIRED',
          blockedAction: 'record approval decision',
          operatorSummary,
          nextSteps: [
            'Record merge decisions for each changed field.',
            'Review the resulting merge summary.',
            'Retry approval after decisions are complete.',
          ],
          messageContract: this.buildConflictMessageContract({
            conflictType: 'MERGE_DECISIONS_REQUIRED',
            message,
            operatorSummary,
          }),
        });
      }

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: `products.workspace.approval.${dto.decision.toLowerCase()}`,
        entity: 'product_workspace_draft',
        entityId: draft.id,
        after: {
          historyLabel: this.toApprovalHistoryLabel(dto.decision),
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'Approval decision was persisted with actor and timestamp for products workspace traceability.',
          approval: {
            decision: dto.decision,
            note: dto.note?.trim() ?? null,
            draftUpdatedAt: draft.updatedAt.toISOString(),
            basedOnProductId: basedOnProduct.id,
            basedOnUpdatedAt: basedOnProduct.updatedAt.toISOString(),
            mergePendingCount: mergeSummary.pendingCount,
            mergeHasDifferences: mergeSummary.hasDifferences,
          },
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async packageHandoff(
    tenantId: string,
    userId: string | null,
    dto: CreateProductWorkspaceHandoffDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'package handoff summary',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'package handoff summary',
      });

      const basedOnProduct = await this.findTenantProductById(
        tx,
        tenantId,
        draft.basedOnProductId,
      );
      await this.assertLinkedProductVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAtRaw: dto.expectedBasedOnUpdatedAt,
        product: basedOnProduct,
        actionLabel: 'package handoff summary',
      });

      const latestMergeDecision = basedOnProduct
        ? await this.findLatestMergeDecision(tx, tenantId, draft.id)
        : null;
      const mergeSummary = basedOnProduct
        ? this.resolveMergeDecisionSummary(
            draft,
            basedOnProduct,
            latestMergeDecision,
          )
        : null;
      const latestApproval = await this.findLatestApprovalDecision(
        tx,
        tenantId,
        draft.id,
      );
      const approvalSummary = this.resolveApprovalSummary(
        mergeSummary,
        latestApproval,
      );
      const handoffPayload = this.buildHandoffPayload({
        dto,
        draft,
        mergeSummary,
        approvalSummary,
      });

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.handoff.packaged',
        entity: 'product_workspace_draft',
        entityId: draft.id,
        after: {
          historyLabel: 'Packaged handoff summary',
          historyOrigin: 'Workspace',
          historyScopeSummary:
            'Created a concise handoff package with changes, pending work, blockers, and expected next decision.',
          handoff: handoffPayload,
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async applyFlags(
    tenantId: string,
    userId: string | null,
    dto: ApplyProductWorkspaceFlagsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'apply queue and review flags',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'apply queue and review flags',
      });

      const targets = await this.resolveRecordTargets(
        tx,
        tenantId,
        dto.recordKeys,
      );
      const currentStates = await tx.productWorkspaceRecordState.findMany({
        where: {
          tenantId,
          OR: targets.map((target) => ({
            recordKind: target.recordKind,
            recordId: target.recordId,
          })),
        },
      });

      const stateMap = new Map(
        currentStates.map((state) => [
          `${state.recordKind}:${state.recordId}`,
          state,
        ]),
      );

      for (const target of targets) {
        const key = `${target.recordKind}:${target.recordId}`;
        const current = stateMap.get(key);
        const nextState = this.resolveNextFlagState(dto.action);

        if (
          !nextState.queued &&
          !nextState.prioritized &&
          !nextState.reviewed
        ) {
          if (current) {
            await tx.productWorkspaceRecordState.delete({
              where: { id: current.id },
            });
          }
          continue;
        }

        await tx.productWorkspaceRecordState.upsert({
          where: {
            tenantId_recordKind_recordId: {
              tenantId,
              recordKind: target.recordKind,
              recordId: target.recordId,
            },
          },
          update: nextState,
          create: {
            tenantId,
            recordKind: target.recordKind,
            recordId: target.recordId,
            ...nextState,
          },
        });
      }

      const auditMeta = this.flagAuditMeta(dto.action, targets.length);
      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: auditMeta.action,
        entity: 'product_workspace_state',
        entityId: DRAFT_RECORD_ID,
        after: {
          historyLabel: auditMeta.label,
          historyOrigin: 'Queue',
          historyScopeSummary: auditMeta.scopeSummary,
          recordCount: targets.length,
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async createWorklist(
    tenantId: string,
    userId: string | null,
    dto: CreateProductWorkspaceWorklistDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.ensureDraft(tx, tenantId);
      const expectedDraftUpdatedAt = this.requireExpectedDraftUpdatedAt(
        dto.expectedDraftUpdatedAt,
        'save a worklist',
      );
      await this.assertDraftVersionMatches({
        client: tx,
        tenantId,
        userId,
        expectedUpdatedAt: expectedDraftUpdatedAt,
        draft,
        actionLabel: 'save a worklist',
      });

      const validTargets = await this.resolveRecordTargets(
        tx,
        tenantId,
        dto.selectedKeys,
      );
      const selectedKeys = validTargets.map((target) =>
        this.toRecordKey(target.recordKind, target.recordId),
      );
      const focusedKey =
        dto.focusedKey &&
        selectedKeys.includes(dto.focusedKey) &&
        dto.focusedKey.length > 0
          ? dto.focusedKey
          : (selectedKeys[0] ?? '');

      const worklist = await tx.productWorkspaceWorklist.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          query: dto.query?.trim() ?? '',
          filter: dto.filter,
          selectedKeys,
          focusedKey,
          scopeSummary: dto.scopeSummary?.trim() ?? '',
        },
      });

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.worklist.saved',
        entity: 'product_workspace_worklist',
        entityId: worklist.id,
        after: {
          historyLabel: `Saved worklist "${worklist.name}"`,
          historyOrigin: 'Queue',
          historyScopeSummary:
            worklist.scopeSummary ||
            'Saved server-backed review context for this tenant.',
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  async deleteWorklist(
    tenantId: string,
    userId: string | null,
    worklistId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const worklist = await tx.productWorkspaceWorklist.findFirst({
        where: { id: worklistId, tenantId },
      });
      if (!worklist) {
        throw new NotFoundException(
          'Saved worklist not found for this tenant.',
        );
      }

      await tx.productWorkspaceWorklist.delete({
        where: { id: worklist.id },
      });

      await this.writeAuditLog(tx, {
        tenantId,
        userId,
        action: 'products.workspace.worklist.deleted',
        entity: 'product_workspace_worklist',
        entityId: worklist.id,
        after: {
          historyLabel: `Deleted worklist "${worklist.name}"`,
          historyOrigin: 'Queue',
          historyScopeSummary:
            worklist.scopeSummary ||
            'Removed a saved server-backed worklist for this tenant.',
        },
      });

      return this.loadWorkspace(tx, tenantId);
    });
  }

  private async loadWorkspace(client: WorkspaceClient, tenantId: string) {
    const draft = await this.ensureDraft(client, tenantId);
    const [linkedProduct, referenceProducts, recordStates, worklists, history] =
      await Promise.all([
        draft.catalogProductId == null
          ? Promise.resolve(null)
          : client.product.findFirst({
              where: { id: draft.catalogProductId, tenantId },
              select: {
                id: true,
                tenantId: true,
                nameAr: true,
                nameEn: true,
                barcode: true,
                strength: true,
                packSize: true,
                trackingMode: true,
                isActive: true,
                updatedAt: true,
              },
            }),
        client.product.findMany({
          where: { tenantId },
          orderBy: [{ nameEn: 'asc' }, { barcode: 'asc' }],
          select: {
            id: true,
            tenantId: true,
            nameAr: true,
            nameEn: true,
            barcode: true,
            strength: true,
            packSize: true,
            trackingMode: true,
            isActive: true,
            updatedAt: true,
          },
        }),
        client.productWorkspaceRecordState.findMany({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
        }),
        client.productWorkspaceWorklist.findMany({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        }),
        client.auditLog.findMany({
          where: {
            tenantId,
            action: { startsWith: 'products.workspace.' },
          },
          orderBy: { createdAt: 'desc' },
          take: 80,
          select: {
            id: true,
            action: true,
            after: true,
            createdAt: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        }),
      ]);
    const basedOnProduct =
      draft.basedOnProductId == null
        ? null
        : (referenceProducts.find(
            (item) => item.id === draft.basedOnProductId,
          ) ?? null);
    const duplicateBarcodeConflict = this.resolveDuplicateBarcodeFromReferences(
      draft,
      referenceProducts,
    );
    const latestMergeDecision = this.readLatestMergeDecisionFromHistory(
      history,
      draft,
      basedOnProduct,
    );
    const mergeDecisionBase = basedOnProduct
      ? this.resolveMergeDecisionSummary(
          draft,
          basedOnProduct,
          latestMergeDecision,
        )
      : this.resolveMergeDecisionSummaryForStandaloneDraft(draft);
    const latestApprovalDecision = this.readLatestApprovalFromHistory(
      history,
      draft,
      basedOnProduct,
    );
    const approvalBase = this.resolveApprovalSummary(
      basedOnProduct ? mergeDecisionBase : null,
      latestApprovalDecision,
    );
    const draftPayload = this.toDraftPayload(
      draft,
      linkedProduct,
      basedOnProduct,
      duplicateBarcodeConflict,
    );
    const mergeDecision = this.reconcileMergeDecisionForLifecycle(
      mergeDecisionBase,
      draftPayload.status,
    );
    const approval = this.reconcileApprovalSummaryForLifecycle(
      approvalBase,
      draftPayload.status,
    );
    const latestPromotion = this.readLatestPromotionFromHistory(history);
    const latestActivation = this.readLatestActivationFromHistory(history);
    const promotion = this.resolvePromotionSummary({
      draft,
      draftStatus: draftPayload.status,
      basedOnProduct,
      linkedProduct,
      duplicateBarcodeConflict,
      mergeSummary: basedOnProduct ? mergeDecision : null,
      approvalSummary: approval,
      latestPromotion,
    });
    const activation = this.resolveActivationSummary({
      draft,
      linkedProduct,
      latestActivation,
    });
    const handoff = this.resolveHandoffSummary(
      history,
      draft,
      mergeDecision,
      approval,
      draftPayload.status,
      activation,
    );

    return {
      truthMode: 'SERVER_BACKED',
      truthNotes: [
        'Working draft, worklists, record flags, and action trail are tenant-scoped and survive reloads.',
        'Table density, sort choice, and panel open state remain local view preferences on this device.',
        'Reference products are server-backed catalog records and stay read-only in this workspace.',
        'Merge decisions, approval traceability, and handoff packages are persisted on the server for this tenant.',
        'Promotion confirmation and operator recovery guidance are persisted on the server for this tenant.',
      ],
      messageContract: this.buildWorkspaceMessageContract({
        mergeDecision,
        approval,
        handoff,
        activation,
      }),
      draft: draftPayload,
      mergeDecision,
      approval,
      promotion,
      activation,
      handoff,
      references: referenceProducts.map((product) =>
        this.toReferencePayload(product),
      ),
      recordStates: recordStates.map((state) => ({
        recordKey: this.toRecordKey(state.recordKind, state.recordId),
        queued: state.queued,
        prioritized: state.prioritized,
        reviewed: state.reviewed,
        updatedAt: state.updatedAt.toISOString(),
      })),
      worklists: worklists.map((worklist) => ({
        id: worklist.id,
        name: worklist.name,
        query: worklist.query,
        filter: worklist.filter,
        selectedKeys: this.readStringArray(worklist.selectedKeys),
        focusedKey: worklist.focusedKey,
        scopeSummary: worklist.scopeSummary,
        createdAt: worklist.createdAt.toISOString(),
        updatedAt: worklist.updatedAt.toISOString(),
      })),
      history: history.map((entry) => this.toHistoryPayload(entry)),
      syncedAt: new Date().toISOString(),
    };
  }

  private async ensureDraft(client: WorkspaceClient, tenantId: string) {
    return client.productWorkspaceDraft.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
      },
    });
  }

  private toDraftPayload(
    draft: DraftSnapshot,
    linkedProduct: ProductSnapshot | null,
    basedOnProduct: ProductSnapshot | null,
    duplicateBarcodeConflict: DuplicateBarcodeConflict | null,
  ) {
    const status = this.resolveDraftStatus(draft, linkedProduct);
    const missingCore = this.resolveMissingCore(draft);
    const missingForCatalog = [...missingCore];
    if (!draft.barcode.trim()) {
      missingForCatalog.push(draftFieldLabels.barcode);
    }
    if (duplicateBarcodeConflict) {
      missingForCatalog.push('Resolve duplicate barcode');
    }

    const canPromote =
      status === 'READY_TO_PROMOTE' && !duplicateBarcodeConflict;
    const operatorSummary = this.resolveOperatorSummary(
      status,
      missingForCatalog,
      duplicateBarcodeConflict,
    );
    const nextStep = this.resolveNextStep(
      status,
      missingForCatalog,
      duplicateBarcodeConflict,
    );

    return {
      id: draft.id,
      recordKey: DRAFT_RECORD_ID,
      source: 'draft',
      nameAr: draft.nameAr,
      nameEn: draft.nameEn,
      barcode: draft.barcode,
      strength: draft.strength,
      packSize: draft.packSize,
      trackingMode: draft.trackingMode,
      status,
      basedOnProductId: draft.basedOnProductId,
      catalogProductId: draft.catalogProductId,
      lastPromotedAt: draft.lastPromotedAt?.toISOString() ?? null,
      lastActivatedAt: draft.lastActivatedAt?.toISOString() ?? null,
      updatedAt: draft.updatedAt.toISOString(),
      concurrency: {
        expectedDraftUpdatedAt: draft.updatedAt.toISOString(),
        expectedCatalogUpdatedAt:
          linkedProduct?.updatedAt.toISOString() ?? null,
        expectedBasedOnUpdatedAt:
          basedOnProduct?.updatedAt.toISOString() ?? null,
      },
      duplicateBarcodeConflict,
      readiness: {
        missingCore,
        missingForCatalog,
        canEdit: draft.catalogProductId == null,
        canPromote,
        canActivate: status === 'PROMOTED_INACTIVE',
        canDeactivate: status === 'PROMOTED_ACTIVE',
        operatorSummary,
        nextStep,
      },
    };
  }

  private toReferencePayload(product: ProductSnapshot) {
    return {
      id: product.id,
      recordKey: this.toRecordKey(
        ProductWorkspaceRecordKind.PRODUCT,
        product.id,
      ),
      source: 'reference',
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      barcode: product.barcode,
      strength: product.strength,
      packSize: product.packSize,
      trackingMode: product.trackingMode,
      status: product.isActive ? 'PROMOTED_ACTIVE' : 'PROMOTED_INACTIVE',
      updatedAt: product.updatedAt.toISOString(),
      readOnly: true,
    };
  }

  private toHistoryPayload(entry: WorkspaceAuditEntry) {
    const after =
      entry.after &&
      typeof entry.after === 'object' &&
      !Array.isArray(entry.after)
        ? (entry.after as Record<string, Prisma.JsonValue>)
        : {};

    return {
      id: entry.id,
      label:
        typeof after.historyLabel === 'string'
          ? after.historyLabel
          : 'Workspace action',
      scopeSummary:
        typeof after.historyScopeSummary === 'string'
          ? after.historyScopeSummary
          : 'Server-backed workspace action recorded for this tenant.',
      origin:
        after.historyOrigin === 'Inspector' ||
        after.historyOrigin === 'Queue' ||
        after.historyOrigin === 'Workspace'
          ? after.historyOrigin
          : 'Workspace',
      createdAt: entry.createdAt.toISOString(),
      action: entry.action,
      actorEmail: entry.user?.email ?? null,
    };
  }

  private toLocalizedMessage(
    value: string | null | undefined,
    fallbackArabic: string,
  ): LocalizedMessage {
    const english = (value ?? '').trim();
    return {
      en: english,
      ar: this.toArabicCriticalMessage(english) ?? fallbackArabic,
    };
  }

  private toArabicCriticalMessage(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const directMap: Record<string, string> = {
      'Activation is ready to be executed against the catalog-listed inactive product.':
        'التفعيل جاهز للتنفيذ على منتج الفهرس غير النشط.',
      'Activation is blocked until the catalog-listed product is ready for launch.':
        'التفعيل محجوب حتى يصبح منتج الفهرس جاهزاً للإطلاق.',
      'Catalog product is already active.': 'منتج الفهرس نشط بالفعل.',
      'Promotion is required before activation can run.':
        'يجب ترقية المسودة إلى الفهرس قبل التفعيل.',
      'No activation is pending until the draft is promoted into catalog.':
        'لا يوجد تفعيل معلّق حتى تُرقّى المسودة إلى الفهرس.',
      'No catalog product is ready for activation yet.':
        'لا يوجد منتج فهرسي جاهز للتفعيل بعد.',
      'Promote the working draft into catalog first.':
        'رقِّ المسودة العاملة إلى الفهرس أولاً.',
      'The working draft changed before your action was saved.':
        'تم رفض الإجراء لأن المسودة العاملة تغيّرت قبل حفظ العملية.',
      'The linked catalog product changed before your action completed.':
        'تم رفض الإجراء لأن منتج الفهرس المرتبط تغيّر قبل اكتمال العملية.',
      'This barcode already belongs to another product in this tenant.':
        'تم رفض الإجراء لأن هذا الباركود مستخدم بالفعل لمنتج آخر ضمن نفس المستأجر.',
      'The catalog product linked to this draft is no longer available.':
        'منتج الفهرس المرتبط بهذه المسودة لم يعد متاحاً.',
      'Move the working draft into catalog before activation.':
        'انقل المسودة العاملة إلى الفهرس قبل التفعيل.',
      'Working draft cannot activate until it is catalog listed and complete.':
        'لا يمكن تفعيل المسودة حتى تصبح مدرجة في الفهرس ومكتملة المتطلبات.',
      'Merge cannot continue until every changed field has an explicit decision.':
        'لا يمكن متابعة الدمج حتى يتم توثيق قرار صريح لكل حقل متغيّر.',
      'Merge approval is required before catalog merge can proceed.':
        'يلزم اعتماد الدمج قبل متابعة دمج الفهرس.',
      'No reference product is linked. Promotion will create or refresh catalog from this draft directly.':
        'لا يوجد منتج مرجعي مرتبط. ستقوم الترقية بإنشاء أو تحديث الفهرس مباشرةً من هذه المسودة.',
      'Draft and reference are already aligned. No merge decision is required.':
        'المسودة والمرجع متطابقان بالفعل. لا يلزم قرار دمج.',
      [ACTIVE_MERGE_TRACEABILITY_SUMMARY]:
        'المنتج في الفهرس نشط بالفعل. تبقى قرارات الدمج محفوظة للتتبّع من لقطة الترقية.',
      'No approval gate is required because there is no active reference merge delta.':
        'لا توجد بوابة اعتماد مطلوبة لأن دمج المرجع لا يحتوي فروقات نشطة.',
      [ACTIVE_APPROVAL_TRACEABILITY_SUMMARY]:
        'المنتج في الفهرس نشط بالفعل. تبقى آثار الاعتماد محفوظة للتتبّع من لقطة الترقية.',
      'Approval is blocked until all changed fields have explicit merge decisions.':
        'الاعتماد محجوب حتى يتم توثيق قرار صريح لكل الحقول المتغيرة.',
      'No approval decision was recorded for this draft version yet.':
        'لم يُسجَّل قرار اعتماد لهذه النسخة من المسودة بعد.',
      'Latest approval decision does not match the current draft snapshot.':
        'آخر قرار اعتماد لا يطابق لقطة المسودة الحالية.',
      'Merge package is approved for promotion.':
        'تم اعتماد حزمة الدمج وهي جاهزة للترقية.',
      'Merge package was rejected and must be revised before promotion.':
        'تم رفض حزمة الدمج ويجب تعديلها قبل الترقية.',
      'Reviewer requested changes before approval.':
        'طلب المراجع تعديلات قبل الاعتماد.',
      'Merge package is waiting for an approval outcome.':
        'حزمة الدمج بانتظار نتيجة الاعتماد.',
      'Handoff package is ready. The next operator can continue without reading raw logs.':
        'حزمة التسليم جاهزة ويمكن للمشغّل التالي المتابعة دون قراءة السجلات الخام.',
      'Handoff package highlights pending work and blockers for the next operator.':
        'حزمة التسليم تُظهر الأعمال المعلّقة والعوائق للمشغّل التالي.',
      'Refresh the workspace, review the latest draft, and retry only after confirming the current state.':
        'حدّث مساحة العمل، راجع أحدث نسخة من المسودة، ثم أعد المحاولة فقط بعد تأكيد الحالة الحالية.',
      'Refresh the workspace, reopen the latest reference product, and retry only after confirming the current state.':
        'حدّث مساحة العمل، أعد فتح أحدث نسخة من المنتج المرجعي، ثم أعد المحاولة فقط بعد تأكيد الحالة الحالية.',
      'Choose a different barcode or open the existing product if that is the intended reference.':
        'اختر باركوداً مختلفاً أو افتح المنتج الموجود إذا كان هو المرجع المقصود.',
      'Promote the draft first, then retry activation once the catalog product exists.':
        'قم بترقية المسودة أولاً ثم أعد محاولة التفعيل بعد وجود منتج الفهرس.',
      'Use deactivate if you need to move the catalog product back to inactive.':
        'استخدم إلغاء التفعيل إذا احتجت إعادة منتج الفهرس إلى حالة غير نشطة.',
      'Promote the draft first, then retry activation once the catalog product is ready.':
        'قم بترقية المسودة أولاً ثم أعد محاولة التفعيل بعد جاهزية منتج الفهرس.',
      'The workspace rejected this action because the latest state changed before completion.':
        'رفضت مساحة العمل هذا الإجراء لأن أحدث حالة تغيّرت قبل اكتمال العملية.',
      'Refresh the workspace, review the latest state, and retry only after clearing the blocker.':
        'حدّث مساحة العمل، راجع أحدث حالة، ثم أعد المحاولة فقط بعد إزالة العائق.',
      'Move working draft into catalog when readiness is complete.':
        'انقل المسودة العاملة إلى الفهرس بعد اكتمال الجاهزية.',
      'Submit for approval if governance requires it, then promote when ready.':
        'أرسل للاعتماد إذا تطلبت الحوكمة ذلك، ثم نفّذ الترقية عند الجاهزية.',
      'Decide every changed field before approval or promotion.':
        'احسم قرار كل حقل متغيّر قبل الاعتماد أو الترقية.',
      'Record approval decision, then promote when approved.':
        'سجّل قرار الاعتماد ثم نفّذ الترقية بعد الموافقة.',
      'Complete merge decisions first.': 'أكمل قرارات الدمج أولاً.',
      'Submit this merge package for approval.':
        'أرسل حزمة الدمج هذه للاعتماد.',
      'Record a fresh approval decision for the current draft version.':
        'سجّل قرار اعتماد جديداً لنسخة المسودة الحالية.',
      'Move the working draft into catalog.':
        'انقل المسودة العاملة إلى الفهرس.',
      'Apply changes, then submit for approval again.':
        'نفّذ التعديلات ثم أعد الإرسال للاعتماد.',
      'Address requested changes, then submit for approval again.':
        'عالج التعديلات المطلوبة ثم أعد الإرسال للاعتماد.',
      'Approve or reject this merge package.': 'اعتمد أو ارفض حزمة الدمج هذه.',
    };

    if (directMap[normalized]) {
      return directMap[normalized];
    }

    const pendingFieldsMatch = normalized.match(
      /^(\d+)\s+field\(s\)\s+differ from reference;\s+(\d+)\s+still need explicit decisions\.$/,
    );
    if (pendingFieldsMatch) {
      return `${pendingFieldsMatch[1]} حقل(حقول) تختلف عن المرجع، وما زال ${pendingFieldsMatch[2]} بحاجة إلى قرار صريح.`;
    }

    const allFieldsMatch = normalized.match(
      /^All\s+(\d+)\s+differing field\(s\)\s+have explicit merge decisions\.$/,
    );
    if (allFieldsMatch) {
      return `تم توثيق قرارات دمج صريحة لكل الحقول المختلفة (${allFieldsMatch[1]}).`;
    }

    return null;
  }

  private buildWorkspaceMessageContract(params: {
    mergeDecision: MergeDecisionSummary;
    approval: ApprovalSummary;
    handoff: HandoffSummary;
    activation: ActivationSummary;
  }): WorkspaceMessageContract {
    return {
      activationReady: this.toLocalizedMessage(
        'Activation is ready to be executed against the catalog-listed inactive product.',
        'التفعيل جاهز للتنفيذ على منتج الفهرس غير النشط.',
      ),
      activationBlocked: this.toLocalizedMessage(
        'Activation is blocked until the catalog-listed product is ready for launch.',
        'التفعيل محجوب حتى يصبح منتج الفهرس جاهزاً للإطلاق.',
      ),
      alreadyActive: this.toLocalizedMessage(
        'Catalog product is already active.',
        'منتج الفهرس نشط بالفعل.',
      ),
      staleConflictRejection: this.toLocalizedMessage(
        'The workspace rejected this action because the latest state changed before completion.',
        'رفضت مساحة العمل هذا الإجراء لأن أحدث حالة تغيّرت قبل اكتمال العملية.',
      ),
      recoveryGuidance: this.toLocalizedMessage(
        'Refresh the workspace, review the latest state, and retry only after clearing the blocker.',
        'حدّث مساحة العمل، راجع أحدث حالة، ثم أعد المحاولة فقط بعد إزالة العائق.',
      ),
      mergeSummary: this.toLocalizedMessage(
        params.mergeDecision.operatorSummary,
        'راجع حالة الدمج وسجّل قرارات الحقول المتغيرة قبل المتابعة.',
      ),
      approvalSummary: this.toLocalizedMessage(
        params.approval.operatorSummary,
        'راجع حالة الاعتماد قبل متابعة الترقية.',
      ),
      handoffSummary: this.toLocalizedMessage(
        params.handoff.summary,
        'راجع ملخص التسليم لمعرفة الحالة الحالية والخطوة التالية.',
      ),
      activationSummary: this.buildActivationSummaryMessageContract(
        params.activation,
      ),
    };
  }

  private buildActivationSummaryMessageContract(
    activation: ActivationSummary,
  ): ActivationSummaryMessageContract {
    const isPromotionRequired =
      activation.currentState ===
      'Promotion is required before activation can run.';
    const isActive =
      activation.currentState === 'Catalog product is active now.';
    return {
      currentState: this.toLocalizedMessage(
        activation.currentState,
        isPromotionRequired
          ? 'يجب ترقية المسودة إلى الفهرس قبل التفعيل.'
          : isActive
            ? 'المنتج في الفهرس نشط الآن.'
            : 'المنتج في الفهرس مسجل لكنه غير نشط.',
      ),
      pendingState: this.toLocalizedMessage(
        activation.pendingState,
        isPromotionRequired
          ? 'لا يوجد تفعيل معلّق حتى تُرقّى المسودة إلى الفهرس.'
          : isActive
            ? 'لا يوجد تفعيل معلّق.'
            : 'التفعيل جاهز للتنفيذ.',
      ),
      changedState: this.toLocalizedMessage(
        activation.changedState,
        isPromotionRequired
          ? 'لا يوجد منتج فهرسي جاهز للتفعيل بعد.'
          : isActive
            ? 'التفعيل مكتمل بالفعل والمنتج في الفهرس ما يزال نشطاً.'
            : 'التفعيل ينقل منتج الفهرس من غير نشط إلى نشط.',
      ),
      nextStep: this.toLocalizedMessage(
        activation.nextStep,
        isPromotionRequired
          ? 'رقِّ المسودة العاملة إلى الفهرس أولاً.'
          : isActive
            ? 'ألغِ تفعيل منتج الفهرس إذا احتجت تغيير حالة الإطلاق.'
            : 'فعّل المنتج فقط عندما تصبح الجاهزية مكتملة.',
      ),
    };
  }

  private buildConflictMessageContract(params: {
    conflictType: string;
    message: string;
    operatorSummary?: string;
    recovery?: WorkspaceRecoverySummary;
  }): WorkspaceMessageContract {
    const rejectionFallbackByType: Record<string, string> = {
      STALE_DRAFT: 'تم رفض الإجراء لأن المسودة تغيّرت قبل حفظ العملية.',
      STALE_CATALOG_PRODUCT:
        'تم رفض الإجراء لأن منتج الفهرس المرتبط تغيّر قبل اكتمال العملية.',
      DUPLICATE_BARCODE:
        'تم رفض الإجراء لأن هذا الباركود مستخدم بالفعل لمنتج آخر ضمن نفس المستأجر.',
      LINKED_PRODUCT_CHANGED: 'منتج الفهرس المرتبط بهذه المسودة لم يعد متاحاً.',
      ACTIVATION_PREREQUISITES_NOT_MET:
        'تم رفض الإجراء لأن التفعيل محجوب حتى تكتمل الجاهزية.',
      ACTIVATION_ALREADY_EXECUTED: 'تم رفض الإجراء لأن منتج الفهرس نشط بالفعل.',
      MERGE_DECISIONS_REQUIRED:
        'تم رفض الإجراء لأن قرارات الدمج المطلوبة لم تُستكمل بعد.',
      APPROVAL_REQUIRED: 'تم رفض الإجراء لأن اعتماد الدمج لم يكتمل بعد.',
    };

    const contract: WorkspaceMessageContract = {
      staleConflictRejection: this.toLocalizedMessage(
        params.message,
        rejectionFallbackByType[params.conflictType] ??
          'تم رفض الإجراء بسبب تغيّر الحالة قبل اكتمال العملية.',
      ),
    };

    if (params.recovery?.guidance) {
      contract.recoveryGuidance = this.toLocalizedMessage(
        params.recovery.guidance,
        'حدّث مساحة العمل، راجع أحدث حالة، ثم أعد المحاولة فقط بعد إزالة العائق.',
      );
    }

    if (params.conflictType === 'ACTIVATION_PREREQUISITES_NOT_MET') {
      contract.activationBlocked = this.toLocalizedMessage(
        params.operatorSummary ?? params.message,
        'التفعيل محجوب حتى يصبح منتج الفهرس جاهزاً للإطلاق.',
      );
    }

    if (params.conflictType === 'ACTIVATION_ALREADY_EXECUTED') {
      contract.alreadyActive = this.toLocalizedMessage(
        params.message,
        'منتج الفهرس نشط بالفعل.',
      );
    }

    if (params.conflictType === 'MERGE_DECISIONS_REQUIRED') {
      contract.mergeSummary = this.toLocalizedMessage(
        params.operatorSummary ?? params.message,
        'لا يمكن متابعة الدمج حتى يتم توثيق قرارات الحقول المتغيرة.',
      );
    }

    if (params.conflictType === 'APPROVAL_REQUIRED') {
      contract.approvalSummary = this.toLocalizedMessage(
        params.operatorSummary ?? params.message,
        'يلزم اعتماد الدمج قبل متابعة الترقية.',
      );
    }

    return contract;
  }

  private resolveDraftStatus(
    draft: DraftSnapshot,
    linkedProduct: ProductSnapshot | null,
  ): DraftStatus {
    if (draft.catalogProductId && linkedProduct?.isActive) {
      return 'PROMOTED_ACTIVE';
    }
    if (draft.catalogProductId) {
      return 'PROMOTED_INACTIVE';
    }

    const missingCore = this.resolveMissingCore(draft);
    const hasAnyContent =
      draft.nameAr.trim().length > 0 ||
      draft.nameEn.trim().length > 0 ||
      draft.barcode.trim().length > 0 ||
      draft.strength.trim().length > 0 ||
      draft.packSize.trim().length > 0;

    if (!hasAnyContent) {
      return 'EMPTY';
    }
    if (missingCore.length > 0) {
      return 'INCOMPLETE';
    }
    if (!draft.barcode.trim()) {
      return 'REVIEWABLE';
    }
    return 'READY_TO_PROMOTE';
  }

  private resolveMissingCore(draft: DraftSnapshot) {
    const missing: string[] = [];
    if (!draft.nameAr.trim()) missing.push(draftFieldLabels.nameAr);
    if (!draft.nameEn.trim()) missing.push(draftFieldLabels.nameEn);
    if (!draft.strength.trim()) missing.push(draftFieldLabels.strength);
    if (!draft.packSize.trim()) missing.push(draftFieldLabels.packSize);
    return missing;
  }

  private resolveOperatorSummary(
    status: DraftStatus,
    missingForCatalog: string[],
    duplicateBarcodeConflict: DuplicateBarcodeConflict | null,
  ) {
    if (duplicateBarcodeConflict) {
      return `Barcode ${duplicateBarcodeConflict.barcode} is already used by ${duplicateBarcodeConflict.conflictingProductName}. Promotion is blocked until you capture a different barcode or reuse that existing product.`;
    }
    if (status === 'EMPTY') {
      return 'Start with product names, strength, and pack so the workspace can judge readiness honestly.';
    }
    if (status === 'INCOMPLETE') {
      return `Still missing: ${missingForCatalog.join(', ')}.`;
    }
    if (status === 'REVIEWABLE') {
      return 'Core details are saved. Capture barcode before moving into catalog.';
    }
    if (status === 'READY_TO_PROMOTE') {
      return 'Required details are complete. The draft can move into catalog as inactive.';
    }
    if (status === 'PROMOTED_INACTIVE') {
      return 'Catalog listed and still inactive. Activation is the next deliberate step.';
    }
    return 'Catalog listed and active.';
  }

  private resolveNextStep(
    status: DraftStatus,
    missingForCatalog: string[],
    duplicateBarcodeConflict: DuplicateBarcodeConflict | null,
  ) {
    if (duplicateBarcodeConflict) {
      return 'Scan a different barcode or open the existing product as reference before you continue.';
    }
    if (status === 'EMPTY' || status === 'INCOMPLETE') {
      return missingForCatalog[0] ?? 'Complete the missing product details.';
    }
    if (status === 'REVIEWABLE') {
      return draftFieldLabels.barcode;
    }
    if (status === 'READY_TO_PROMOTE') {
      return 'Move working draft into catalog';
    }
    if (status === 'PROMOTED_INACTIVE') {
      return 'Activate when the product is truly launch-ready';
    }
    return 'Keep active or return the draft to planning mode before editing';
  }

  private requireExpectedDraftUpdatedAt(
    value: string | undefined,
    actionLabel: string,
  ) {
    const parsed = this.parseExpectedUpdatedAt(value);
    if (!parsed) {
      throw new BadRequestException(
        `Refresh the workspace before you ${actionLabel}.`,
      );
    }

    return parsed;
  }

  private parseExpectedUpdatedAt(value: string | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'Refresh the workspace and try again because the concurrency marker is invalid.',
      );
    }

    return parsed;
  }

  private async assertDraftVersionMatches(params: {
    client: WorkspaceClient;
    tenantId: string;
    userId: string | null;
    expectedUpdatedAt: Date;
    draft: DraftSnapshot;
    actionLabel: string;
  }) {
    if (
      params.draft.updatedAt.getTime() === params.expectedUpdatedAt.getTime()
    ) {
      return;
    }

    throw await this.buildStaleDraftConflict({
      client: params.client,
      tenantId: params.tenantId,
      userId: params.userId,
      draftId: params.draft.id,
      currentUpdatedAt: params.draft.updatedAt,
      actionLabel: params.actionLabel,
    });
  }

  private async assertLinkedProductVersionMatches(params: {
    client: WorkspaceClient;
    tenantId: string;
    userId: string | null;
    expectedUpdatedAtRaw: string | undefined;
    product: ProductSnapshot | null;
    actionLabel: string;
  }) {
    const expectedUpdatedAt = this.parseExpectedUpdatedAt(
      params.expectedUpdatedAtRaw,
    );
    if (!expectedUpdatedAt) {
      return;
    }

    if (!params.product) {
      const message =
        'The catalog product linked to this draft is no longer available.';
      const operatorSummary =
        'This draft is no longer linked to the same catalog product you opened.';
      throw new ConflictException({
        message,
        conflictType: 'LINKED_PRODUCT_CHANGED',
        operatorSummary,
        blockedAction: params.actionLabel,
        nextSteps: [
          'Refresh the workspace.',
          'Open the latest linked product in the reference list.',
          'Decide whether to continue with this draft or start a new one.',
        ],
        messageContract: this.buildConflictMessageContract({
          conflictType: 'LINKED_PRODUCT_CHANGED',
          message,
          operatorSummary,
        }),
      });
    }

    if (params.product.updatedAt.getTime() === expectedUpdatedAt.getTime()) {
      return;
    }

    throw await this.buildStaleLinkedProductConflict({
      client: params.client,
      tenantId: params.tenantId,
      userId: params.userId,
      productId: params.product.id,
      actionLabel: params.actionLabel,
    });
  }

  private async buildStaleDraftConflict(params: {
    client: WorkspaceClient;
    tenantId: string;
    userId: string | null;
    draftId: string;
    currentUpdatedAt: Date;
    actionLabel: string;
  }) {
    const actor = await this.findLatestDraftActor(
      params.client,
      params.tenantId,
      params.draftId,
    );
    const actorSummary = this.resolveActorSummary(actor, params.userId);
    const changedAt = actor?.changedAt ?? params.currentUpdatedAt.toISOString();

    const message = 'The working draft changed before your action was saved.';
    const recovery = {
      retrySafe: true,
      refreshRequired: true,
      reopenRequired: true,
      rollbackMode: 'NON_DESTRUCTIVE' as const,
      unchangedState:
        'No catalog change was committed because the working draft changed first.',
      guidance:
        'Refresh the workspace, review the latest draft, and retry only after confirming the current state.',
    };

    return new ConflictException({
      message,
      conflictType: 'STALE_DRAFT',
      blockedAction: params.actionLabel,
      operatorSummary: `${actorSummary} updated the working draft at ${changedAt}.`,
      changedBy: actor?.email ?? null,
      changedAt,
      recovery,
      nextSteps: [
        'Refresh the workspace to load the newest draft.',
        'Review what changed in the draft and reference rows.',
        `Repeat "${params.actionLabel}" only after reviewing the latest state.`,
      ],
      messageContract: this.buildConflictMessageContract({
        conflictType: 'STALE_DRAFT',
        message,
        recovery,
      }),
    });
  }

  private async buildStaleLinkedProductConflict(params: {
    client: WorkspaceClient;
    tenantId: string;
    userId: string | null;
    productId: string;
    actionLabel: string;
  }) {
    const latestProduct = await this.findTenantProductById(
      params.client,
      params.tenantId,
      params.productId,
    );

    const message =
      'The linked catalog product changed before your action completed.';
    const recovery = {
      retrySafe: true,
      refreshRequired: true,
      reopenRequired: true,
      rollbackMode: 'NON_DESTRUCTIVE' as const,
      unchangedState:
        'No catalog change was committed because the linked catalog product changed first.',
      guidance:
        'Refresh the workspace, reopen the latest reference product, and retry only after confirming the current state.',
    };

    return new ConflictException({
      message,
      conflictType: 'STALE_CATALOG_PRODUCT',
      blockedAction: params.actionLabel,
      operatorSummary: latestProduct
        ? `Catalog product "${this.formatProductDisplayName(latestProduct)}" was updated at ${latestProduct.updatedAt.toISOString()}.`
        : 'The catalog product linked to this draft is no longer available.',
      changedBy: null,
      changedAt: latestProduct?.updatedAt.toISOString() ?? null,
      recovery,
      nextSteps: [
        'Refresh the workspace first.',
        'Compare the linked catalog product with your draft.',
        `Run "${params.actionLabel}" again only if it is still correct.`,
      ],
      messageContract: this.buildConflictMessageContract({
        conflictType: 'STALE_CATALOG_PRODUCT',
        message,
        recovery,
      }),
    });
  }

  private async findDuplicateBarcodeConflict(
    client: WorkspaceClient,
    tenantId: string,
    barcode: string,
    excludeProductId: string | null,
  ): Promise<DuplicateBarcodeConflict | null> {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) {
      return null;
    }

    const conflict = await client.product.findFirst({
      where: {
        tenantId,
        barcode: normalizedBarcode,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!conflict) {
      return null;
    }

    return {
      barcode: normalizedBarcode,
      conflictingProductId: conflict.id,
      conflictingProductName: this.formatProductDisplayName(conflict),
      conflictingProductStatus: conflict.isActive ? 'ACTIVE' : 'INACTIVE',
      conflictingProductUpdatedAt: conflict.updatedAt.toISOString(),
    };
  }

  private resolveDuplicateBarcodeFromReferences(
    draft: DraftSnapshot,
    references: ProductSnapshot[],
  ): DuplicateBarcodeConflict | null {
    const normalizedBarcode = draft.barcode.trim();
    if (!normalizedBarcode) {
      return null;
    }

    const allowedProductId = draft.catalogProductId ?? draft.basedOnProductId;
    const conflict = references.find(
      (item) =>
        item.barcode.trim() === normalizedBarcode &&
        item.id !== allowedProductId,
    );
    if (!conflict) {
      return null;
    }

    return {
      barcode: normalizedBarcode,
      conflictingProductId: conflict.id,
      conflictingProductName: this.formatProductDisplayName(conflict),
      conflictingProductStatus: conflict.isActive ? 'ACTIVE' : 'INACTIVE',
      conflictingProductUpdatedAt: conflict.updatedAt.toISOString(),
    };
  }

  private buildDuplicateBarcodeConflict(
    conflict: DuplicateBarcodeConflict,
    actionLabel: string,
  ) {
    const message =
      'This barcode already belongs to another product in this tenant.';
    const recovery = {
      retrySafe: true,
      refreshRequired: false,
      reopenRequired: false,
      rollbackMode: 'NON_DESTRUCTIVE' as const,
      unchangedState:
        'No catalog change was committed because the barcode already exists elsewhere in this tenant.',
      guidance:
        'Choose a different barcode or open the existing product if that is the intended reference.',
    };

    return new ConflictException({
      message,
      conflictType: 'DUPLICATE_BARCODE',
      blockedAction: actionLabel,
      operatorSummary: `Barcode ${conflict.barcode} is already assigned to "${conflict.conflictingProductName}" (${conflict.conflictingProductStatus.toLowerCase()}).`,
      changedBy: null,
      changedAt: conflict.conflictingProductUpdatedAt,
      recovery,
      conflictingProduct: {
        id: conflict.conflictingProductId,
        name: conflict.conflictingProductName,
        status: conflict.conflictingProductStatus,
      },
      nextSteps: [
        'Scan a different barcode for this draft.',
        'If the scan is correct, open the existing product instead of creating a duplicate.',
        'Refresh if you need the latest product list before retrying.',
      ],
      messageContract: this.buildConflictMessageContract({
        conflictType: 'DUPLICATE_BARCODE',
        message,
        recovery,
      }),
    });
  }

  private async findLatestDraftActor(
    client: WorkspaceClient,
    tenantId: string,
    draftId: string,
  ): Promise<WorkspaceConflictActor | null> {
    const latest = await client.auditLog.findFirst({
      where: {
        tenantId,
        entity: 'product_workspace_draft',
        entityId: draftId,
        action: { startsWith: 'products.workspace.' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });
    if (!latest) {
      return null;
    }

    return {
      userId: latest.userId,
      email: latest.user?.email ?? null,
      changedAt: latest.createdAt.toISOString(),
    };
  }

  private resolveActorSummary(
    actor: WorkspaceConflictActor | null,
    currentUserId: string | null,
  ) {
    if (!actor) {
      return 'Another team member';
    }
    if (currentUserId && actor.userId && actor.userId === currentUserId) {
      return 'You in another session';
    }
    if (actor.email) {
      return actor.email;
    }
    return 'Another team member';
  }

  private async findTenantProductById(
    client: WorkspaceClient,
    tenantId: string,
    productId: string | null,
  ): Promise<ProductSnapshot | null> {
    if (!productId) {
      return null;
    }

    return client.product.findFirst({
      where: { id: productId, tenantId },
      select: {
        id: true,
        tenantId: true,
        nameAr: true,
        nameEn: true,
        barcode: true,
        strength: true,
        packSize: true,
        trackingMode: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  private formatProductDisplayName(product: {
    nameEn: string;
    nameAr: string;
    id?: string;
  }) {
    const value = product.nameEn.trim() || product.nameAr.trim();
    if (value) {
      return value;
    }
    return product.id ?? 'Unnamed product';
  }

  private buildDraftUpdateData(dto: UpdateProductWorkspaceDraftDto) {
    const data: Prisma.ProductWorkspaceDraftUpdateInput = {};

    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr.trim();
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn.trim();
    if (dto.barcode !== undefined) data.barcode = dto.barcode.trim();
    if (dto.strength !== undefined) data.strength = dto.strength.trim();
    if (dto.packSize !== undefined) data.packSize = dto.packSize.trim();
    if (dto.trackingMode !== undefined) data.trackingMode = dto.trackingMode;

    return data;
  }

  private didCreateMeaningfulDraft(dto: UpdateProductWorkspaceDraftDto) {
    return editableDraftFields.some((field) => dto[field] !== undefined);
  }

  private async findLatestMergeDecision(
    client: WorkspaceClient,
    tenantId: string,
    draftId: string,
  ): Promise<MergeDecisionAuditSnapshot | null> {
    const latest = await client.auditLog.findFirst({
      where: {
        tenantId,
        entity: 'product_workspace_draft',
        entityId: draftId,
        action: 'products.workspace.merge.decided',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        after: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return this.parseMergeDecisionEntry(latest);
  }

  private readLatestMergeDecisionFromHistory(
    history: WorkspaceAuditEntry[],
    draft: DraftSnapshot,
    basedOnProduct: ProductSnapshot | null,
  ): MergeDecisionAuditSnapshot | null {
    const latest = history.find(
      (entry) => entry.action === 'products.workspace.merge.decided',
    );
    const parsed = this.parseMergeDecisionEntry(latest ?? null);
    if (!parsed || !basedOnProduct) {
      return null;
    }

    return parsed.draftUpdatedAt === draft.updatedAt.toISOString() &&
      parsed.basedOnProductId === basedOnProduct.id
      ? parsed
      : null;
  }

  private parseMergeDecisionEntry(
    entry: WorkspaceAuditEntry | null,
  ): MergeDecisionAuditSnapshot | null {
    if (!entry) {
      return null;
    }

    const after = this.readJsonObject(entry.after);
    const mergeDecision = this.readJsonObject(after?.mergeDecision ?? null);
    if (!mergeDecision) {
      return null;
    }

    const rawDecisions = this.readJsonObject(mergeDecision.decisions ?? null);
    const decisions: Partial<
      Record<MergeDecisionField, ProductWorkspaceMergeDecision>
    > = {};
    for (const field of mergeDecisionFields) {
      const value = rawDecisions?.[field];
      if (
        value === ProductWorkspaceMergeDecision.APPLY_DRAFT ||
        value === ProductWorkspaceMergeDecision.KEEP_REFERENCE
      ) {
        decisions[field] = value;
      }
    }

    return {
      decisions,
      decisionSetAt: entry.createdAt.toISOString(),
      decidedBy: entry.user?.email ?? null,
      rationale: this.readString(mergeDecision.rationale) ?? null,
      draftUpdatedAt: this.readString(mergeDecision.draftUpdatedAt) ?? null,
      basedOnProductId: this.readString(mergeDecision.basedOnProductId) ?? null,
    };
  }

  private normalizeMergeDecisions(
    decisions: ApplyProductWorkspaceMergeDecisionsDto['decisions'],
    allowedFields: MergeDecisionField[],
  ) {
    const allowed = new Set(allowedFields);
    const normalized: Partial<
      Record<MergeDecisionField, ProductWorkspaceMergeDecision>
    > = {};
    for (const decision of decisions) {
      const field = decision.fieldKey as MergeDecisionField;
      if (!allowed.has(field)) {
        throw new BadRequestException(
          `Cannot decide "${field}" because it does not differ from the reference.`,
        );
      }
      if (normalized[field]) {
        throw new BadRequestException(
          `Merge decision for "${field}" is duplicated in this request.`,
        );
      }
      normalized[field] = decision.decision;
    }

    if (Object.keys(normalized).length === 0) {
      throw new BadRequestException(
        'Record at least one merge decision before continuing.',
      );
    }

    return normalized;
  }

  private resolveMergeDecisionSummaryForStandaloneDraft(
    draft: DraftSnapshot,
  ): MergeDecisionSummary {
    return {
      draftUpdatedAt: draft.updatedAt.toISOString(),
      basedOnProductId: null,
      diffs: [],
      hasDifferences: false,
      referenceRecordKey: null,
      decisionSetAt: null,
      decidedBy: null,
      rationale: null,
      pendingCount: 0,
      applyDraftCount: 0,
      keepReferenceCount: 0,
      operatorSummary:
        'No reference product is linked. Promotion will create or refresh catalog from this draft directly.',
      nextStep: 'Move working draft into catalog when readiness is complete.',
    };
  }

  private resolveMergeDecisionSummary(
    draft: DraftSnapshot,
    basedOnProduct: ProductSnapshot,
    latestDecision: MergeDecisionAuditSnapshot | null,
  ): MergeDecisionSummary {
    const decisionMap =
      latestDecision &&
      latestDecision.draftUpdatedAt === draft.updatedAt.toISOString() &&
      latestDecision.basedOnProductId === basedOnProduct.id
        ? latestDecision.decisions
        : {};

    const diffs: MergeDecisionSummary['diffs'] = [];
    let pendingCount = 0;
    let applyDraftCount = 0;
    let keepReferenceCount = 0;

    for (const field of mergeDecisionFields) {
      const draftValue = this.readMergeFieldValueFromDraft(draft, field);
      const referenceValue = this.readMergeFieldValueFromProduct(
        basedOnProduct,
        field,
      );
      if (draftValue === referenceValue) {
        continue;
      }

      const decision = decisionMap[field] ?? null;
      if (!decision) {
        pendingCount += 1;
      } else if (decision === ProductWorkspaceMergeDecision.APPLY_DRAFT) {
        applyDraftCount += 1;
      } else if (decision === ProductWorkspaceMergeDecision.KEEP_REFERENCE) {
        keepReferenceCount += 1;
      }

      diffs.push({
        field,
        label: mergeDecisionFieldLabels[field],
        referenceValue,
        draftValue,
        decision,
      });
    }

    const hasDifferences = diffs.length > 0;
    const operatorSummary = !hasDifferences
      ? 'Draft and reference are already aligned. No merge decision is required.'
      : pendingCount > 0
        ? `${diffs.length} field(s) differ from reference; ${pendingCount} still need explicit decisions.`
        : `All ${diffs.length} differing field(s) have explicit merge decisions.`;
    const nextStep = !hasDifferences
      ? 'Submit for approval if governance requires it, then promote when ready.'
      : pendingCount > 0
        ? 'Decide every changed field before approval or promotion.'
        : 'Record approval decision, then promote when approved.';

    return {
      draftUpdatedAt: draft.updatedAt.toISOString(),
      basedOnProductId: basedOnProduct.id,
      diffs,
      hasDifferences,
      referenceRecordKey: this.toRecordKey(
        ProductWorkspaceRecordKind.PRODUCT,
        basedOnProduct.id,
      ),
      decisionSetAt: hasDifferences
        ? (latestDecision?.decisionSetAt ?? null)
        : null,
      decidedBy: hasDifferences ? (latestDecision?.decidedBy ?? null) : null,
      rationale: hasDifferences ? (latestDecision?.rationale ?? null) : null,
      pendingCount,
      applyDraftCount,
      keepReferenceCount,
      operatorSummary,
      nextStep,
    };
  }

  private resolvePromoteValues(
    draft: DraftSnapshot,
    targetProduct: ProductSnapshot | null,
    mergeSummary: MergeDecisionSummary | null,
  ) {
    const promoted = {
      nameAr: draft.nameAr,
      nameEn: draft.nameEn,
      barcode: draft.barcode,
      strength: draft.strength,
      packSize: draft.packSize,
      trackingMode: draft.trackingMode,
    };
    if (!targetProduct || !mergeSummary || !mergeSummary.hasDifferences) {
      return promoted;
    }

    for (const diff of mergeSummary.diffs) {
      if (diff.decision !== ProductWorkspaceMergeDecision.KEEP_REFERENCE) {
        continue;
      }

      if (diff.field === 'nameAr') promoted.nameAr = targetProduct.nameAr;
      if (diff.field === 'nameEn') promoted.nameEn = targetProduct.nameEn;
      if (diff.field === 'barcode') promoted.barcode = targetProduct.barcode;
      if (diff.field === 'strength') promoted.strength = targetProduct.strength;
      if (diff.field === 'packSize') promoted.packSize = targetProduct.packSize;
      if (diff.field === 'trackingMode') {
        promoted.trackingMode = targetProduct.trackingMode;
      }
    }

    return promoted;
  }

  private buildPromotionExecutionPlan(
    draft: DraftSnapshot,
    targetProduct: ProductSnapshot | null,
    mergeSummary: MergeDecisionSummary | null,
  ): PromotionExecutionPlan {
    const items = mergeDecisionFields.map((field) => {
      const source =
        targetProduct &&
        mergeSummary?.hasDifferences &&
        mergeSummary.diffs.some(
          (diff) =>
            diff.field === field &&
            diff.decision === ProductWorkspaceMergeDecision.KEEP_REFERENCE,
        )
          ? ProductWorkspacePromotionSource.REFERENCE
          : ProductWorkspacePromotionSource.DRAFT;
      return {
        fieldKey: field,
        label: mergeDecisionFieldLabels[field],
        source,
        value: this.readPromotionFieldValue(
          draft,
          targetProduct,
          mergeSummary,
          field,
        ),
      };
    });

    return {
      mode: ProductWorkspacePromotionMode.PROMOTE_DRAFT,
      targetState: ProductWorkspacePromotionTargetState.PROMOTED_INACTIVE,
      items,
      summary:
        'Promote the working draft into catalog as an inactive catalog product.',
      nextStep:
        'Confirm promotion when the snapshot is validated, then execute the move into catalog.',
    };
  }

  private isPromotionPlanAligned(
    requested: ProductWorkspacePromotionPlanDto,
    actual: PromotionExecutionPlan,
  ) {
    if (
      requested.mode !== actual.mode ||
      requested.targetState !== actual.targetState ||
      requested.items.length !== actual.items.length
    ) {
      return false;
    }

    return requested.items.every((item, index) => {
      const actualItem = actual.items[index];
      return (
        item.fieldKey === actualItem.fieldKey &&
        item.source === actualItem.source &&
        item.value === actualItem.value
      );
    });
  }

  private buildPromotionExecutionConflict(params: {
    plan: PromotionExecutionPlan;
    actionLabel: string;
    conflictType: string;
    message: string;
    operatorSummary: string;
    nextSteps: string[];
    recovery: WorkspaceRecoverySummary;
  }) {
    return new ConflictException({
      message: params.message,
      conflictType: params.conflictType,
      blockedAction: params.actionLabel,
      operatorSummary: params.operatorSummary,
      changedBy: null,
      changedAt: null,
      promotionPlan: params.plan,
      nextSteps: params.nextSteps,
      recovery: params.recovery,
      messageContract: this.buildConflictMessageContract({
        conflictType: params.conflictType,
        message: params.message,
        operatorSummary: params.operatorSummary,
        recovery: params.recovery,
      }),
    });
  }

  private buildActivationExecutionConflict(params: {
    conflictType: string;
    message: string;
    operatorSummary: string;
    nextSteps: string[];
    recovery: WorkspaceRecoverySummary;
  }) {
    return new ConflictException({
      message: params.message,
      conflictType: params.conflictType,
      blockedAction: 'activate the catalog product',
      operatorSummary: params.operatorSummary,
      changedBy: null,
      changedAt: null,
      nextSteps: params.nextSteps,
      recovery: params.recovery,
      messageContract: this.buildConflictMessageContract({
        conflictType: params.conflictType,
        message: params.message,
        operatorSummary: params.operatorSummary,
        recovery: params.recovery,
      }),
    });
  }

  private buildPromotionAuditSnapshot(params: {
    targetProduct: ProductSnapshot | null;
    mergeSummary: MergeDecisionSummary | null;
    promotionPlan: PromotionExecutionPlan;
    promotedAt: Date;
    promotedProductId: string | null;
  }) {
    const items = params.promotionPlan.items.map((item) => ({
      fieldKey: item.fieldKey,
      label: item.label,
      source: item.source,
      value: item.value,
    }));
    const changed = items.map((item) =>
      item.source === ProductWorkspacePromotionSource.REFERENCE
        ? `${item.label}: reference value retained`
        : `${item.label}: draft value promoted`,
    );

    return {
      promotedAt: params.promotedAt.toISOString(),
      promotedBy: null,
      promotedProductId: params.promotedProductId,
      basedOnProductId: params.mergeSummary?.basedOnProductId ?? null,
      mode: params.promotionPlan.mode,
      targetState: params.promotionPlan.targetState,
      items,
      changed,
      activeState: params.promotedProductId
        ? 'Catalog product is inactive until activation is executed.'
        : 'Catalog product record was created inactive.',
      referenceState: params.targetProduct
        ? 'Reference product remains read-only in the workspace.'
        : 'No reference product was linked to this promotion.',
      finalState: 'Promotion completed and the draft now sits in catalog.',
      summary:
        'Promotion confirmation is persisted on the server and can be reviewed after refresh.',
      nextStep:
        'Activate the catalog product when launch approval is complete.',
    };
  }

  private buildActivationAuditSnapshot(params: {
    product: ProductSnapshot;
    draft: DraftSnapshot;
    activatedAt: Date;
  }) {
    return {
      activatedAt: params.activatedAt.toISOString(),
      activatedBy: null,
      activatedProductId: params.product.id,
      basedOnProductId: params.draft.basedOnProductId,
      currentState: 'Catalog product is active now.',
      pendingState: 'No activation is pending.',
      changedState: ACTIVE_ACTIVATION_CHANGED_STATE,
      finalState: 'Catalog product is active.',
      summary:
        'Activation confirmation is persisted on the server and can be reviewed after refresh.',
      nextStep: 'Deactivate the catalog product if it needs to be withdrawn.',
    };
  }

  private resolveActivationSummary(params: {
    draft: DraftSnapshot;
    linkedProduct: ProductSnapshot | null;
    latestActivation: ActivationAuditSnapshot | null;
  }): ActivationSummary {
    const catalogListed = params.draft.catalogProductId != null;
    const productActive = Boolean(params.linkedProduct?.isActive);
    const readiness = this.toDraftPayload(
      params.draft,
      params.linkedProduct,
      params.linkedProduct,
      null,
    ).readiness;
    const ready = catalogListed && !productActive && readiness.canActivate;

    const currentState = !catalogListed
      ? 'Promotion is required before activation can run.'
      : productActive
        ? 'Catalog product is active now.'
        : 'Catalog product is listed but inactive.';
    const pendingState = !catalogListed
      ? 'No activation is pending until the draft is promoted into catalog.'
      : productActive
        ? 'No activation is pending.'
        : 'Activation is ready to be executed.';
    const changedState = !catalogListed
      ? 'No catalog product is ready for activation yet.'
      : productActive
        ? ACTIVE_ACTIVATION_CHANGED_STATE
        : 'Activation changes the catalog-listed product from inactive to active.';

    return {
      ready,
      operatorSummary: params.latestActivation
        ? productActive
          ? 'Last activation confirmation is persisted on the server and can be reviewed after refresh.'
          : 'Last activation confirmation is persisted on the server, but the catalog product is currently inactive.'
        : ready
          ? 'The catalog-listed product is inactive and ready for deliberate activation.'
          : currentState,
      nextStep: !catalogListed
        ? 'Promote the working draft into catalog first.'
        : productActive
          ? 'Deactivate the catalog product if you need to change its launch state.'
          : readiness.nextStep,
      currentState,
      pendingState,
      changedState,
      confirmation: params.latestActivation,
    };
  }

  private readPromotionFieldValue(
    draft: DraftSnapshot,
    targetProduct: ProductSnapshot | null,
    mergeSummary: MergeDecisionSummary | null,
    field: ProductWorkspacePromotionFieldKey,
  ) {
    if (
      targetProduct &&
      mergeSummary?.hasDifferences &&
      mergeSummary.diffs.some(
        (diff) =>
          diff.field === field &&
          diff.decision === ProductWorkspaceMergeDecision.KEEP_REFERENCE,
      )
    ) {
      return this.readMergeFieldValueFromProduct(targetProduct, field);
    }

    return this.readMergeFieldValueFromDraft(draft, field);
  }

  private async findLatestApprovalDecision(
    client: WorkspaceClient,
    tenantId: string,
    draftId: string,
  ): Promise<ApprovalAuditSnapshot | null> {
    const latest = await client.auditLog.findFirst({
      where: {
        tenantId,
        entity: 'product_workspace_draft',
        entityId: draftId,
        action: { startsWith: 'products.workspace.approval.' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        after: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return this.parseApprovalEntry(latest);
  }

  private readLatestApprovalFromHistory(
    history: WorkspaceAuditEntry[],
    draft: DraftSnapshot,
    basedOnProduct: ProductSnapshot | null,
  ): ApprovalAuditSnapshot | null {
    const latest = history.find((entry) =>
      entry.action.startsWith('products.workspace.approval.'),
    );
    const parsed = this.parseApprovalEntry(latest ?? null);
    if (!parsed || !basedOnProduct) {
      return null;
    }

    return parsed.draftUpdatedAt === draft.updatedAt.toISOString() &&
      parsed.basedOnProductId === basedOnProduct.id
      ? parsed
      : null;
  }

  private parseApprovalEntry(
    entry: WorkspaceAuditEntry | null,
  ): ApprovalAuditSnapshot | null {
    if (!entry) {
      return null;
    }

    const after = this.readJsonObject(entry.after);
    const approval = this.readJsonObject(after?.approval ?? null);
    if (!approval) {
      return null;
    }

    const decision = this.readString(approval.decision);
    if (
      decision !== ProductWorkspaceApprovalDecision.SUBMIT_FOR_APPROVAL &&
      decision !== ProductWorkspaceApprovalDecision.APPROVED &&
      decision !== ProductWorkspaceApprovalDecision.REJECTED &&
      decision !== ProductWorkspaceApprovalDecision.REQUEST_CHANGES
    ) {
      return null;
    }

    return {
      decision,
      decisionLabel: this.toApprovalHistoryLabel(decision),
      decidedAt: entry.createdAt.toISOString(),
      decidedBy: entry.user?.email ?? null,
      note: this.readString(approval.note) ?? null,
      draftUpdatedAt: this.readString(approval.draftUpdatedAt) ?? null,
      basedOnProductId: this.readString(approval.basedOnProductId) ?? null,
    };
  }

  private readLatestPromotionFromHistory(
    history: WorkspaceAuditEntry[],
  ): PromotionAuditSnapshot | null {
    const latest = history.find(
      (entry) => entry.action === 'products.workspace.draft.promoted',
    );
    return this.parsePromotionEntry(latest ?? null);
  }

  private readLatestActivationFromHistory(
    history: WorkspaceAuditEntry[],
  ): ActivationAuditSnapshot | null {
    const latest = history.find(
      (entry) => entry.action === 'products.workspace.draft.activated',
    );
    return this.parseActivationEntry(latest ?? null);
  }

  private parsePromotionEntry(
    entry: WorkspaceAuditEntry | null,
  ): PromotionAuditSnapshot | null {
    if (!entry) {
      return null;
    }

    const after = this.readJsonObject(entry.after);
    const promotion = this.readJsonObject(after?.promotion ?? null);
    if (!promotion) {
      return null;
    }

    const rawItems = Array.isArray(promotion.items)
      ? promotion.items
      : ([] as Prisma.JsonValue[]);
    const items = rawItems
      .map((item) => {
        const entryItem = this.readJsonObject(item);
        const fieldKey = this.readString(entryItem?.fieldKey);
        const source = this.readString(entryItem?.source);
        if (
          !fieldKey ||
          !productWorkspacePromotionFieldKeys.includes(
            fieldKey as ProductWorkspacePromotionFieldKey,
          ) ||
          (source !== ProductWorkspacePromotionSource.DRAFT &&
            source !== ProductWorkspacePromotionSource.REFERENCE)
        ) {
          return null;
        }

        return {
          fieldKey: fieldKey as ProductWorkspacePromotionFieldKey,
          label:
            this.readString(entryItem?.label) ??
            mergeDecisionFieldLabels[
              fieldKey as ProductWorkspacePromotionFieldKey
            ],
          source,
          value: this.readString(entryItem?.value) ?? '',
        };
      })
      .filter(
        (item): item is PromotionPlanItem =>
          item != null && item.value.length > 0,
      );
    if (items.length === 0) {
      return null;
    }

    const mode = this.readString(promotion.mode);
    const targetState = this.readString(promotion.targetState);
    if (
      mode !== ProductWorkspacePromotionMode.PROMOTE_DRAFT ||
      targetState !== ProductWorkspacePromotionTargetState.PROMOTED_INACTIVE
    ) {
      return null;
    }

    return {
      promotedAt: entry.createdAt.toISOString(),
      promotedBy: entry.user?.email ?? null,
      promotedProductId: this.readString(promotion.promotedProductId) ?? null,
      basedOnProductId: this.readString(promotion.basedOnProductId) ?? null,
      mode,
      targetState,
      items,
      changed: this.readStringArray(promotion.changed ?? []),
      activeState:
        this.readString(promotion.activeState) ??
        'Catalog product is inactive until activation is executed.',
      referenceState:
        this.readString(promotion.referenceState) ??
        'Reference product remains read-only in the workspace.',
      finalState:
        this.readString(promotion.finalState) ??
        'Promotion completed and the draft now sits in catalog.',
      summary:
        this.readString(promotion.summary) ??
        'Promotion confirmation is persisted on the server and can be reviewed after refresh.',
      nextStep:
        this.readString(promotion.nextStep) ??
        'Activate the catalog product when launch approval is complete.',
    };
  }

  private parseActivationEntry(
    entry: WorkspaceAuditEntry | null,
  ): ActivationAuditSnapshot | null {
    if (!entry) {
      return null;
    }

    const after = this.readJsonObject(entry.after);
    const activation = this.readJsonObject(after?.activation ?? null);
    if (!activation) {
      return null;
    }

    return {
      activatedAt: entry.createdAt.toISOString(),
      activatedBy: entry.user?.email ?? null,
      activatedProductId:
        this.readString(activation.activatedProductId) ?? null,
      basedOnProductId: this.readString(activation.basedOnProductId) ?? null,
      currentState:
        this.readString(activation.currentState) ??
        'Catalog product is active now.',
      pendingState:
        this.readString(activation.pendingState) ?? 'No activation is pending.',
      changedState:
        this.readString(activation.changedState) ??
        ACTIVE_ACTIVATION_CHANGED_STATE,
      finalState:
        this.readString(activation.finalState) ?? 'Catalog product is active.',
      summary:
        this.readString(activation.summary) ??
        'Activation confirmation is persisted on the server and can be reviewed after refresh.',
      nextStep:
        this.readString(activation.nextStep) ??
        'Deactivate the catalog product if it needs to be withdrawn.',
    };
  }

  private resolveApprovalSummary(
    mergeSummary: MergeDecisionSummary | null,
    latestApproval: ApprovalAuditSnapshot | null,
  ): ApprovalSummary {
    const required = Boolean(mergeSummary?.hasDifferences);
    if (!required) {
      return {
        required: false,
        status: 'NOT_REQUIRED',
        lastDecision: latestApproval,
        operatorSummary:
          'No approval gate is required because there is no active reference merge delta.',
        nextStep: 'Promote when readiness and barcode checks pass.',
      };
    }

    if (mergeSummary && mergeSummary.pendingCount > 0) {
      return {
        required: true,
        status: 'PENDING_REVIEW',
        lastDecision: latestApproval,
        operatorSummary:
          'Approval is blocked until all changed fields have explicit merge decisions.',
        nextStep: 'Complete merge decisions first.',
      };
    }

    if (!latestApproval) {
      return {
        required: true,
        status: 'PENDING_REVIEW',
        lastDecision: null,
        operatorSummary:
          'No approval decision was recorded for this draft version yet.',
        nextStep: 'Submit this merge package for approval.',
      };
    }

    if (
      latestApproval.draftUpdatedAt !== mergeSummary?.draftUpdatedAt ||
      latestApproval.basedOnProductId !== mergeSummary?.basedOnProductId
    ) {
      return {
        required: true,
        status: 'PENDING_REVIEW',
        lastDecision: latestApproval,
        operatorSummary:
          'Latest approval decision does not match the current draft snapshot.',
        nextStep:
          'Record a fresh approval decision for the current draft version.',
      };
    }

    if (latestApproval.decision === ProductWorkspaceApprovalDecision.APPROVED) {
      return {
        required: true,
        status: 'APPROVED',
        lastDecision: latestApproval,
        operatorSummary: 'Merge package is approved for promotion.',
        nextStep: 'Move the working draft into catalog.',
      };
    }

    if (latestApproval.decision === ProductWorkspaceApprovalDecision.REJECTED) {
      return {
        required: true,
        status: 'REJECTED',
        lastDecision: latestApproval,
        operatorSummary:
          'Merge package was rejected and must be revised before promotion.',
        nextStep: 'Apply changes, then submit for approval again.',
      };
    }

    if (
      latestApproval.decision ===
      ProductWorkspaceApprovalDecision.REQUEST_CHANGES
    ) {
      return {
        required: true,
        status: 'CHANGES_REQUESTED',
        lastDecision: latestApproval,
        operatorSummary: 'Reviewer requested changes before approval.',
        nextStep: 'Address requested changes, then submit for approval again.',
      };
    }

    return {
      required: true,
      status: 'PENDING_REVIEW',
      lastDecision: latestApproval,
      operatorSummary: 'Merge package is waiting for an approval outcome.',
      nextStep: 'Approve or reject this merge package.',
    };
  }

  private reconcileMergeDecisionForLifecycle(
    mergeSummary: MergeDecisionSummary,
    draftStatus: DraftStatus,
  ): MergeDecisionSummary {
    if (draftStatus !== 'PROMOTED_ACTIVE') {
      return mergeSummary;
    }

    return {
      ...mergeSummary,
      operatorSummary: ACTIVE_MERGE_TRACEABILITY_SUMMARY,
      nextStep: ACTIVE_TRACEABILITY_NEXT_STEP,
    };
  }

  private reconcileApprovalSummaryForLifecycle(
    approvalSummary: ApprovalSummary,
    draftStatus: DraftStatus,
  ): ApprovalSummary {
    if (draftStatus !== 'PROMOTED_ACTIVE') {
      return approvalSummary;
    }

    return {
      ...approvalSummary,
      operatorSummary: ACTIVE_APPROVAL_TRACEABILITY_SUMMARY,
      nextStep: ACTIVE_TRACEABILITY_NEXT_STEP,
    };
  }

  private resolvePromotionSummary(params: {
    draft: DraftSnapshot;
    draftStatus: DraftStatus;
    basedOnProduct: ProductSnapshot | null;
    linkedProduct: ProductSnapshot | null;
    duplicateBarcodeConflict: DuplicateBarcodeConflict | null;
    mergeSummary: MergeDecisionSummary | null;
    approvalSummary: ApprovalSummary;
    latestPromotion: PromotionAuditSnapshot | null;
  }): PromotionSummary {
    const draftReadiness = this.toDraftPayload(
      params.draft,
      params.linkedProduct,
      params.basedOnProduct,
      params.duplicateBarcodeConflict,
    ).readiness;
    const executionPlan = this.buildPromotionExecutionPlan(
      params.draft,
      params.linkedProduct ?? params.basedOnProduct,
      params.mergeSummary,
    );
    const ready =
      params.draftStatus === 'READY_TO_PROMOTE' &&
      draftReadiness.canPromote &&
      (!params.mergeSummary || params.mergeSummary.pendingCount === 0) &&
      (!params.approvalSummary.required ||
        params.approvalSummary.status === 'APPROVED');
    const promotedLifecycle =
      params.draftStatus === 'PROMOTED_INACTIVE' ||
      params.draftStatus === 'PROMOTED_ACTIVE';
    const lifecycleNextStep =
      params.draftStatus === 'PROMOTED_ACTIVE'
        ? ACTIVE_HANDOFF_NEXT_STEP
        : 'Activate when the product is truly launch-ready';
    const rawConfirmation =
      promotedLifecycle && params.latestPromotion
        ? {
            ...params.latestPromotion,
            nextStep: lifecycleNextStep,
          }
        : null;
    const confirmation =
      rawConfirmation && params.draftStatus === 'PROMOTED_ACTIVE'
        ? {
            ...rawConfirmation,
            activeState: ACTIVE_PROMOTION_CONFIRMATION_STATE,
            finalState:
              'Catalog product is active and promotion traceability is preserved.',
            summary:
              'Promotion confirmation remains persisted for traceability while the catalog product stays active.',
            nextStep: lifecycleNextStep,
          }
        : rawConfirmation;

    const operatorSummary = confirmation
      ? params.draftStatus === 'PROMOTED_ACTIVE'
        ? 'Promotion confirmation is persisted and the catalog product is currently active.'
        : 'Last promotion confirmation is persisted on the server and can be reviewed after refresh.'
      : !ready && params.mergeSummary && params.mergeSummary.pendingCount > 0
        ? `${params.mergeSummary.operatorSummary} Promotion is blocked until every changed field is decided.`
        : !ready &&
            params.approvalSummary.required &&
            params.approvalSummary.status !== 'APPROVED'
          ? `${params.approvalSummary.operatorSummary} Promotion is blocked until approval is complete.`
          : !ready
            ? draftReadiness.operatorSummary
            : 'Review the execution plan below, then confirm the promotion before executing it.';

    return {
      ready,
      operatorSummary,
      nextStep: promotedLifecycle
        ? lifecycleNextStep
        : !ready && params.mergeSummary && params.mergeSummary.pendingCount > 0
          ? params.mergeSummary.nextStep
          : !ready &&
              params.approvalSummary.required &&
              params.approvalSummary.status !== 'APPROVED'
            ? params.approvalSummary.nextStep
            : !ready
              ? draftReadiness.nextStep
              : executionPlan.nextStep,
      executionPlan,
      confirmation,
    };
  }

  private toApprovalHistoryLabel(decision: ProductWorkspaceApprovalDecision) {
    if (decision === ProductWorkspaceApprovalDecision.SUBMIT_FOR_APPROVAL) {
      return 'Submitted merge package for approval';
    }
    if (decision === ProductWorkspaceApprovalDecision.APPROVED) {
      return 'Approved merge package';
    }
    if (decision === ProductWorkspaceApprovalDecision.REQUEST_CHANGES) {
      return 'Requested changes on merge package';
    }
    return 'Rejected merge package';
  }

  private buildHandoffPayload(params: {
    dto: CreateProductWorkspaceHandoffDto;
    draft: DraftSnapshot;
    mergeSummary: MergeDecisionSummary | null;
    approvalSummary: ApprovalSummary;
  }) {
    const core = this.composeHandoffSummary(
      params.draft,
      params.mergeSummary,
      params.approvalSummary,
      params.dto.expectedDecision,
    );
    return {
      ...core,
      draftUpdatedAt: params.draft.updatedAt.toISOString(),
      basedOnProductId: params.mergeSummary?.basedOnProductId ?? null,
      note: params.dto.note?.trim() ?? null,
    };
  }

  private resolveHandoffSummary(
    history: WorkspaceAuditEntry[],
    draft: DraftSnapshot,
    mergeSummary: MergeDecisionSummary,
    approval: ApprovalSummary,
    draftStatus: DraftStatus,
    activation: ActivationSummary,
  ): HandoffSummary {
    const latest = this.readLatestHandoffFromHistory(
      history,
      draft,
      mergeSummary.basedOnProductId,
    );
    const base =
      latest ?? this.composeHandoffSummary(draft, mergeSummary, approval);
    return this.reconcileHandoffForLifecycle(base, draftStatus, activation);
  }

  private reconcileHandoffForLifecycle(
    handoff: HandoffSummary,
    draftStatus: DraftStatus,
    activation: ActivationSummary,
  ): HandoffSummary {
    if (draftStatus === 'PROMOTED_ACTIVE') {
      return {
        ...handoff,
        ready: true,
        expectedDecision: ProductWorkspaceHandoffExpectedDecision.NONE,
        summary:
          'Catalog product is already active. Handoff remains for traceability while launch state stays active.',
        nextStep: ACTIVE_HANDOFF_NEXT_STEP,
      };
    }

    if (draftStatus === 'PROMOTED_INACTIVE') {
      const lifecycleNextStep =
        'Activate when the product is truly launch-ready. If activation is blocked, refresh workspace truth, clear blockers, then retry activation.';
      return {
        ...handoff,
        ready: activation.ready,
        expectedDecision: ProductWorkspaceHandoffExpectedDecision.NONE,
        summary: activation.ready
          ? 'Catalog product is promoted and inactive. Activation is the next operator action.'
          : 'Catalog product is promoted but activation is blocked until readiness is revalidated.',
        nextStep: lifecycleNextStep,
      };
    }

    return handoff;
  }

  private readLatestHandoffFromHistory(
    history: WorkspaceAuditEntry[],
    draft: DraftSnapshot,
    basedOnProductId: string | null,
  ): HandoffSummary | null {
    const latest = history.find(
      (entry) => entry.action === 'products.workspace.handoff.packaged',
    );
    if (!latest) {
      return null;
    }

    const after = this.readJsonObject(latest.after);
    const handoff = this.readJsonObject(after?.handoff ?? null);
    if (!handoff) {
      return null;
    }

    const handoffDraftUpdatedAt = this.readString(handoff.draftUpdatedAt);
    const handoffBasedOnProductId = this.readString(handoff.basedOnProductId);
    if (
      handoffDraftUpdatedAt !== draft.updatedAt.toISOString() ||
      (handoffBasedOnProductId ?? null) !== basedOnProductId
    ) {
      return null;
    }

    const expectedDecisionRaw = this.readString(handoff.expectedDecision);
    const expectedDecision =
      expectedDecisionRaw ===
        ProductWorkspaceHandoffExpectedDecision.REVIEW_MERGE_DECISIONS ||
      expectedDecisionRaw ===
        ProductWorkspaceHandoffExpectedDecision.APPROVE_MERGE ||
      expectedDecisionRaw ===
        ProductWorkspaceHandoffExpectedDecision.APPLY_CHANGES ||
      expectedDecisionRaw ===
        ProductWorkspaceHandoffExpectedDecision.PROMOTE_DRAFT
        ? expectedDecisionRaw
        : ProductWorkspaceHandoffExpectedDecision.NONE;

    return {
      ready: this.readBoolean(handoff.ready) ?? false,
      packagedAt: latest.createdAt.toISOString(),
      packagedBy: latest.user?.email ?? null,
      summary:
        this.readString(handoff.summary) ??
        'Handoff package was generated for this draft.',
      changed: this.readStringArray(handoff.changed ?? []),
      pending: this.readStringArray(handoff.pending ?? []),
      blockers: this.readStringArray(handoff.blockers ?? []),
      expectedDecision,
      nextStep:
        this.readString(handoff.nextStep) ??
        this.expectedDecisionNextStep(expectedDecision),
    };
  }

  private composeHandoffSummary(
    draft: DraftSnapshot,
    mergeSummary: MergeDecisionSummary | null,
    approvalSummary: ApprovalSummary,
    expectedDecisionOverride?: ProductWorkspaceHandoffExpectedDecision,
  ): HandoffSummary {
    const changed: string[] = [];
    const pending: string[] = [];
    if (mergeSummary?.hasDifferences) {
      for (const diff of mergeSummary.diffs) {
        if (diff.decision === ProductWorkspaceMergeDecision.APPLY_DRAFT) {
          changed.push(`${diff.label}: apply draft value`);
        } else if (
          diff.decision === ProductWorkspaceMergeDecision.KEEP_REFERENCE
        ) {
          changed.push(`${diff.label}: keep reference value`);
        } else {
          pending.push(`${diff.label}: decision required`);
        }
      }
    }

    const blockers: string[] = [];
    const missingCore = this.resolveMissingCore(draft);
    if (!draft.barcode.trim()) {
      missingCore.push(draftFieldLabels.barcode);
    }
    if (missingCore.length > 0) {
      blockers.push(`Missing requirements: ${missingCore.join(', ')}`);
    }
    if (pending.length > 0) {
      blockers.push('Merge decisions are still pending.');
    }
    if (approvalSummary.required && approvalSummary.status !== 'APPROVED') {
      blockers.push(`Approval status is ${approvalSummary.status}.`);
    }

    const expectedDecision =
      expectedDecisionOverride ??
      (pending.length > 0
        ? ProductWorkspaceHandoffExpectedDecision.REVIEW_MERGE_DECISIONS
        : approvalSummary.required && approvalSummary.status !== 'APPROVED'
          ? approvalSummary.status === 'REJECTED' ||
            approvalSummary.status === 'CHANGES_REQUESTED'
            ? ProductWorkspaceHandoffExpectedDecision.APPLY_CHANGES
            : ProductWorkspaceHandoffExpectedDecision.APPROVE_MERGE
          : blockers.length > 0
            ? ProductWorkspaceHandoffExpectedDecision.APPLY_CHANGES
            : ProductWorkspaceHandoffExpectedDecision.PROMOTE_DRAFT);

    const nextStep = this.expectedDecisionNextStep(expectedDecision);
    return {
      ready: blockers.length === 0,
      packagedAt: null,
      packagedBy: null,
      summary:
        blockers.length === 0
          ? 'Handoff package is ready. The next operator can continue without reading raw logs.'
          : 'Handoff package highlights pending work and blockers for the next operator.',
      changed,
      pending,
      blockers,
      expectedDecision,
      nextStep,
    };
  }

  private expectedDecisionNextStep(
    expectedDecision: ProductWorkspaceHandoffExpectedDecision,
  ) {
    if (
      expectedDecision ===
      ProductWorkspaceHandoffExpectedDecision.REVIEW_MERGE_DECISIONS
    ) {
      return 'Review each changed field and record merge decisions.';
    }
    if (
      expectedDecision === ProductWorkspaceHandoffExpectedDecision.APPROVE_MERGE
    ) {
      return 'Approve or reject the merge package for this draft snapshot.';
    }
    if (
      expectedDecision === ProductWorkspaceHandoffExpectedDecision.APPLY_CHANGES
    ) {
      return 'Apply requested changes, then create a fresh handoff package.';
    }
    if (
      expectedDecision === ProductWorkspaceHandoffExpectedDecision.PROMOTE_DRAFT
    ) {
      return 'Promote the working draft into catalog.';
    }
    return 'No additional handoff decision is pending.';
  }

  private readMergeFieldValueFromDraft(
    draft: DraftSnapshot,
    field: MergeDecisionField,
  ) {
    if (field === 'nameAr') return draft.nameAr.trim();
    if (field === 'nameEn') return draft.nameEn.trim();
    if (field === 'barcode') return draft.barcode.trim();
    if (field === 'strength') return draft.strength.trim();
    if (field === 'packSize') return draft.packSize.trim();
    return draft.trackingMode;
  }

  private readMergeFieldValueFromProduct(
    product: ProductSnapshot,
    field: MergeDecisionField,
  ) {
    if (field === 'nameAr') return product.nameAr.trim();
    if (field === 'nameEn') return product.nameEn.trim();
    if (field === 'barcode') return product.barcode.trim();
    if (field === 'strength') return product.strength.trim();
    if (field === 'packSize') return product.packSize.trim();
    return product.trackingMode;
  }

  private readJsonObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, Prisma.JsonValue>;
  }

  private readString(value: Prisma.JsonValue | null | undefined) {
    return typeof value === 'string' ? value : null;
  }

  private readBoolean(value: Prisma.JsonValue | null | undefined) {
    return typeof value === 'boolean' ? value : null;
  }

  private async resolveRecordTargets(
    client: WorkspaceClient,
    tenantId: string,
    recordKeys: string[],
  ) {
    const keys = Array.from(
      new Set(recordKeys.map((value) => value.trim()).filter(Boolean)),
    );
    if (keys.length === 0) {
      throw new BadRequestException('Select at least one record first.');
    }

    const productKeys = keys.filter((key) => key !== DRAFT_RECORD_ID);
    const products =
      productKeys.length === 0
        ? []
        : await client.product.findMany({
            where: {
              tenantId,
              id: { in: productKeys },
            },
            select: { id: true },
          });

    if (products.length !== productKeys.length) {
      throw new BadRequestException(
        'One or more selected records are not available in this tenant.',
      );
    }

    return keys.map((key) =>
      key === DRAFT_RECORD_ID
        ? {
            recordKind: ProductWorkspaceRecordKind.DRAFT,
            recordId: DRAFT_RECORD_ID,
          }
        : {
            recordKind: ProductWorkspaceRecordKind.PRODUCT,
            recordId: key,
          },
    );
  }

  private resolveNextFlagState(action: ProductWorkspaceFlagAction) {
    if (action === ProductWorkspaceFlagAction.QUEUE) {
      return {
        queued: true,
        prioritized: false,
        reviewed: false,
      };
    }
    if (action === ProductWorkspaceFlagAction.PRIORITIZE) {
      return {
        queued: true,
        prioritized: true,
        reviewed: false,
      };
    }
    if (action === ProductWorkspaceFlagAction.MARK_REVIEWED) {
      return {
        queued: false,
        prioritized: false,
        reviewed: true,
      };
    }
    return {
      queued: false,
      prioritized: false,
      reviewed: false,
    };
  }

  private flagAuditMeta(action: ProductWorkspaceFlagAction, count: number) {
    if (action === ProductWorkspaceFlagAction.QUEUE) {
      return {
        action: 'products.workspace.flags.queued',
        label: 'Queued selected set',
        scopeSummary: `${count} record(s) were queued for follow-up in the server-backed workspace.`,
      };
    }
    if (action === ProductWorkspaceFlagAction.PRIORITIZE) {
      return {
        action: 'products.workspace.flags.prioritized',
        label: 'Prioritized selected set',
        scopeSummary: `${count} record(s) were marked priority in the server-backed workspace.`,
      };
    }
    if (action === ProductWorkspaceFlagAction.MARK_REVIEWED) {
      return {
        action: 'products.workspace.flags.reviewed',
        label: 'Marked selected set reviewed',
        scopeSummary: `${count} record(s) were marked reviewed and removed from queued follow-up.`,
      };
    }
    return {
      action: 'products.workspace.flags.cleared',
      label: 'Cleared selected workflow flags',
      scopeSummary: `${count} record(s) had queued, priority, and review flags cleared.`,
    };
  }

  private toRecordKey(
    recordKind: ProductWorkspaceRecordKind,
    recordId: string,
  ) {
    return recordKind === ProductWorkspaceRecordKind.DRAFT
      ? DRAFT_RECORD_ID
      : recordId;
  }

  private readStringArray(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) {
      return [] as string[];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private async writeAuditLog(
    client: WorkspaceClient,
    params: {
      tenantId: string;
      userId: string | null;
      action: string;
      entity: string;
      entityId: string;
      after: Prisma.JsonObject;
    },
  ) {
    await client.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        after: params.after,
      },
    });
  }
}
