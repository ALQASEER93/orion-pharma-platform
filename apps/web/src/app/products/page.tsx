"use client";

import { useEffect, useRef, useState } from "react";
import { pageHelpRegistry } from "@/lib/help-registry";
import { useOperatorSession } from "@/lib/operator-session";
import {
  hasProductsMessageContract,
  resolveProductsCriticalMessage,
  resolveServerLocalizedMessage,
} from "@/lib/products-message-contract";
import { resolveProductsResidualFallback } from "@/lib/products-residual-fallback";

type TrackingMode = "NONE" | "EXPIRY_ONLY" | "LOT_EXPIRY";
type WorkspaceFilter =
  | "ALL"
  | "INCOMPLETE"
  | "REVIEWABLE"
  | "READY_TO_PROMOTE"
  | "ACTIVE"
  | "INACTIVE";
type DraftStatus =
  | "EMPTY"
  | "INCOMPLETE"
  | "REVIEWABLE"
  | "READY_TO_PROMOTE"
  | "PROMOTED_INACTIVE"
  | "PROMOTED_ACTIVE";
type DensityMode = "COMFORTABLE" | "COMPACT";
type SortKey = "NAME" | "READINESS" | "SOURCE";
type InspectorTab = "record" | "worklists" | "history" | "help";
type UiLanguage = "EN" | "AR";
type WorkspaceNotice = {
  kind: "success" | "info";
  message: string;
};

type PromotionExecutionPlan = {
  canExecute: boolean;
  snapshotLabel: string;
  referenceLabel: string;
  promotedStateLabel: string;
  changedStateLabel: string;
  blockers: string[];
  nextStep: string;
  confirmedPlan: {
    mode: "PROMOTE_DRAFT";
    targetState: "PROMOTED_INACTIVE";
    items: Array<{
      fieldKey: "nameAr" | "nameEn" | "barcode" | "strength" | "packSize" | "trackingMode";
      source: "DRAFT" | "REFERENCE";
      value: string;
      label: string;
    }>;
  } | null;
};

type PromotionConfirmationSummary = {
  promotedAt: string;
  productLabel: string;
  referenceLabel: string;
  stateChangeLabel: string;
  currentStateLabel: string;
  finalStateLabel: string;
  nextStep: string;
};

type PromotionRecoverySummary = {
  unchanged: string;
  retrySafety: string;
  refreshOrReopen: string;
  nextStep: string;
};

type PromotionRecoveryPayload = {
  retrySafe: boolean;
  refreshRequired: boolean;
  reopenRequired: boolean;
  rollbackMode: "NON_DESTRUCTIVE";
  unchangedState: string;
  guidance: string;
};

type ServerLocalizedMessage = {
  en: string;
  ar?: string | null;
};

type ActivationSummaryContract = {
  currentState?: ServerLocalizedMessage | string | null;
  pendingState?: ServerLocalizedMessage | string | null;
  changedState?: ServerLocalizedMessage | string | null;
  nextStep?: ServerLocalizedMessage | string | null;
};

type WorkspaceMessageContract = {
  activationReady?: ServerLocalizedMessage | string | null;
  activationBlocked?: ServerLocalizedMessage | string | null;
  alreadyActive?: ServerLocalizedMessage | string | null;
  staleConflictRejection?: ServerLocalizedMessage | string | null;
  recoveryGuidance?: ServerLocalizedMessage | string | null;
  mergeSummary?: ServerLocalizedMessage | string | null;
  approvalSummary?: ServerLocalizedMessage | string | null;
  handoffSummary?: ServerLocalizedMessage | string | null;
  activationSummary?: ActivationSummaryContract | null;
};

type DuplicateBarcodeConflictPayload = {
  barcode: string;
  conflictingProductId: string;
  conflictingProductName: string;
  conflictingProductStatus: "ACTIVE" | "INACTIVE";
  conflictingProductUpdatedAt: string;
};

type WorkspaceConflictPayload = {
  message: string;
  conflictType: string;
  blockedAction?: string;
  operatorSummary?: string;
  changedBy?: string | null;
  changedAt?: string | null;
  nextSteps?: string[];
  conflictingProduct?: {
    id: string;
    name: string;
    status: "ACTIVE" | "INACTIVE";
  };
  recovery?: PromotionRecoveryPayload;
  messageContract?: WorkspaceMessageContract;
};

type DraftPayload = {
  id: string;
  recordKey: "draft";
  source: "draft";
  nameAr: string;
  nameEn: string;
  barcode: string;
  strength: string;
  packSize: string;
  trackingMode: TrackingMode;
  status: DraftStatus;
  basedOnProductId: string | null;
  catalogProductId: string | null;
  lastPromotedAt: string | null;
  lastActivatedAt: string | null;
  updatedAt: string;
  concurrency: {
    expectedDraftUpdatedAt: string;
    expectedCatalogUpdatedAt: string | null;
    expectedBasedOnUpdatedAt: string | null;
  };
  duplicateBarcodeConflict: DuplicateBarcodeConflictPayload | null;
  readiness: {
    missingCore: string[];
    missingForCatalog: string[];
    canEdit: boolean;
    canPromote: boolean;
    canActivate: boolean;
    canDeactivate: boolean;
    operatorSummary: string;
    nextStep: string;
  };
};

type ReferencePayload = {
  id: string;
  recordKey: string;
  source: "reference";
  nameAr: string;
  nameEn: string;
  barcode: string;
  strength: string;
  packSize: string;
  trackingMode: TrackingMode;
  status: "PROMOTED_INACTIVE" | "PROMOTED_ACTIVE";
  updatedAt: string;
  readOnly: true;
};

type RecordStatePayload = {
  recordKey: string;
  queued: boolean;
  prioritized: boolean;
  reviewed: boolean;
  updatedAt: string;
};

type WorklistPayload = {
  id: string;
  name: string;
  query: string;
  filter: WorkspaceFilter;
  selectedKeys: string[];
  focusedKey: string;
  scopeSummary: string;
  createdAt: string;
  updatedAt: string;
};

type HistoryPayload = {
  id: string;
  label: string;
  scopeSummary: string;
  origin: "Workspace" | "Inspector" | "Queue";
  createdAt: string;
  action: string;
};

type MergeDecisionValue = "APPLY_DRAFT" | "KEEP_REFERENCE";

type MergeDiffPayload = {
  field: "nameAr" | "nameEn" | "barcode" | "strength" | "packSize" | "trackingMode";
  label: string;
  referenceValue: string;
  draftValue: string;
  decision: MergeDecisionValue | null;
};

type MergeDecisionPayload = {
  draftUpdatedAt: string;
  basedOnProductId: string | null;
  diffs: MergeDiffPayload[];
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
};

type ApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

type ApprovalPayload = {
  required: boolean;
  status: ApprovalStatus;
  lastDecision: {
    decision:
      | "SUBMIT_FOR_APPROVAL"
      | "APPROVED"
      | "REJECTED"
      | "REQUEST_CHANGES";
    decisionLabel: string;
    decidedAt: string;
    decidedBy: string | null;
    note: string | null;
  } | null;
  operatorSummary: string;
  nextStep: string;
};

type HandoffExpectedDecision =
  | "REVIEW_MERGE_DECISIONS"
  | "APPROVE_MERGE"
  | "APPLY_CHANGES"
  | "PROMOTE_DRAFT"
  | "NONE";

type HandoffPayload = {
  ready: boolean;
  packagedAt: string | null;
  packagedBy: string | null;
  summary: string;
  changed: string[];
  pending: string[];
  blockers: string[];
  expectedDecision: HandoffExpectedDecision;
  nextStep: string;
};

type PromotionPayload = {
  ready: boolean;
  operatorSummary: string;
  nextStep: string;
  executionPlan: {
    mode: "PROMOTE_DRAFT";
    targetState: "PROMOTED_INACTIVE";
    items: Array<{
      fieldKey: "nameAr" | "nameEn" | "barcode" | "strength" | "packSize" | "trackingMode";
      label: string;
      source: "DRAFT" | "REFERENCE";
      value: string;
    }>;
    summary: string;
    nextStep: string;
  };
  confirmation: {
    promotedAt: string;
    promotedBy: string | null;
    promotedProductId: string | null;
    basedOnProductId: string | null;
    mode: "PROMOTE_DRAFT";
    targetState: "PROMOTED_INACTIVE";
    items: Array<{
      fieldKey: "nameAr" | "nameEn" | "barcode" | "strength" | "packSize" | "trackingMode";
      label: string;
      source: "DRAFT" | "REFERENCE";
      value: string;
    }>;
    changed: string[];
    activeState: string;
    referenceState: string;
    finalState: string;
    summary: string;
    nextStep: string;
  } | null;
};

type WorkspaceResponse = {
  truthMode: "SERVER_BACKED";
  truthNotes: string[];
  messageContract?: WorkspaceMessageContract;
  draft: DraftPayload;
  mergeDecision: MergeDecisionPayload;
  approval: ApprovalPayload;
  promotion: PromotionPayload;
  handoff: HandoffPayload;
  references: ReferencePayload[];
  recordStates: RecordStatePayload[];
  worklists: WorklistPayload[];
  history: HistoryPayload[];
  syncedAt: string;
};

type SessionPayload = {
  accessToken: string;
  tenantId: string;
  branchId: string | null;
  apiBase: string;
  user: {
    id: string;
    email: string;
    tenantId: string;
    branchId?: string | null;
    role: string;
    permissions: string[];
  } | null;
};

type DraftForm = Pick<
  DraftPayload,
  "nameAr" | "nameEn" | "barcode" | "strength" | "packSize" | "trackingMode"
>;

type WorkspaceRecord = DraftPayload | ReferencePayload;

type WorkspacePreferences = {
  density: DensityMode;
  sortKey: SortKey;
};

const helpContentEn = pageHelpRegistry.products;
const helpContentAr: typeof helpContentEn = {
  route: "/products",
  pageName: "مساحة عمل المنتجات",
  purpose:
    "جهّز مسودة عمل واحدة، وقارنها بالمنتجات المرجعية، ثم انقل المسودة إلى حالات الفهرس الفعلية فقط عندما يؤكد الخادم الجاهزية.",
  startHere: [
    "استخدم البحث لإظهار المنتج الذي تريد العمل عليه.",
    "حدد صفاً واحداً لفتح عناصر الإجراء وسياق القرار.",
    "افتح لوحة المسودة العاملة عندما تحتاج إلى حفظ تفاصيل المنتج على الخادم.",
  ],
  sections: [
    {
      id: "table",
      title: "الجدول الرئيسي",
      summary: "هذه هي منطقة العمل الأساسية.",
      details: [
        "كل صف يمثل إما المسودة العاملة أو منتجاً مرجعياً للقراءة فقط.",
        "تساعدك عوامل التصفية على التركيز حسب الجاهزية أو حالة التفعيل.",
        "التحديد هو الذي يحدد الإجراءات المتاحة.",
      ],
    },
    {
      id: "draft",
      title: "المسودة العاملة",
      summary: "استخدم هذه المنطقة لتعديل تفاصيل المنتج فقط.",
      details: [
        "يُحفظ محتوى المسودة على الخادم للمستأجر النشط.",
        "لا يتم تعديل المنتجات المرجعية من هذه اللوحة.",
        "تتحدد الجاهزية من الحقول الإلزامية وليس من العناوين الشكلية.",
      ],
    },
    {
      id: "barcode",
      title: "مسار الباركود",
      summary: "تدفق يبدأ بالمسح مع بديل واضح.",
      details: [
        "المفضل: ابدأ بالمسح.",
        "ثانياً: إذا كان القارئ يعمل كلوحة مفاتيح فأدخل القراءة داخل حقل الباركود.",
        "عند التعذر فقط: استخدم الإدخال اليدوي.",
      ],
    },
    {
      id: "conflicts",
      title: "معالجة التعارضات",
      summary: "الإجراءات غير الآمنة تُحجب مع خطوات تالية واضحة.",
      details: [
        "إذا عدّل مشغل آخر المسودة أولاً، يتم حجب الإجراء بدلاً من الكتابة فوق التغييرات.",
        "تُحجب محاولات الباركود المكرر ويظهر مالك المنتج الحالي بوضوح.",
        "حدّث البيانات، وقارن ما تغيّر، ثم أعد المحاولة فقط بعد المراجعة.",
      ],
    },
    {
      id: "queues-history",
      title: "قوائم العمل وسجل الإجراءات",
      summary: "احفظ سياق مراجعة قابل لإعادة الاستخدام وتتبع إجراءات الخادم.",
      details: [
        "تعيد قوائم العمل المحفوظة البحث والتصفية والتحديد والتركيز كما كانت.",
        "يسجل سجل الإجراءات أحداث مساحة العمل ذات المعنى والمدعومة من الخادم.",
        "يمكن أن تبقى تفضيلات العرض محلية بينما تظل حقيقة المنتج آمنة للمستأجر على الخلفية.",
      ],
    },
  ],
  glossary: [
    {
      term: "المسودة العاملة",
      meaning: "سجل منتج قابل للتعديل للتحضير الآمن للمستأجر قبل تغييرات الفهرس.",
    },
    {
      term: "المنتج المرجعي",
      meaning: "منتج فهرس للقراءة فقط يُستخدم للمقارنة.",
    },
    {
      term: "تحتاج تفاصيل",
      meaning: "ما زالت حقول إلزامية ناقصة.",
    },
    {
      term: "جاهزة للمراجعة",
      meaning: "اكتملت الحقول الأساسية؛ والخطوة التالية هي تدقيق المسؤول.",
    },
    {
      term: "جاهزة للفهرس",
      meaning: "يمكن ترقية المسودة إلى مسار الفهرس.",
    },
    {
      term: "حجب بسبب تعارض",
      meaning:
        "تم إيقاف إجراء لأن المسودة أو سجل الفهرس المرتبط تغيّر بعد فتحه.",
    },
    {
      term: "قائمة عمل محفوظة",
      meaning:
        "سياق مراجعة محفوظ على الخادم يعيد البحث والتصفية والصفوف المحددة والتركيز.",
    },
  ],
  truthNotes: [
    "لا يُكتب أي رمز حساس داخل عنوان URL.",
    "المسودة العاملة وقوائم العمل وسجل الإجراءات مدعومة من الخادم للمستأجر النشط.",
    "تتطلب إجراءات التعديل علامة تزامن حديثة حتى لا تكتب البيانات القديمة فوق عمل الفريق بصمت.",
    "يمكن أن تبقى تفضيلات العرض فقط مثل الكثافة أو الترتيب محلية على هذا الجهاز.",
    "تبقى المنتجات المرجعية للقراءة فقط داخل هذه المساحة.",
  ],
};
const sourceLabelsByLanguage: Record<UiLanguage, Record<WorkspaceRecord["source"], string>> = {
  EN: {
    draft: "Editable working draft",
    reference: "Read-only reference",
  },
  AR: {
    draft: "مسودة قابلة للتعديل",
    reference: "مرجع للقراءة فقط",
  },
};
const filterOptions: WorkspaceFilter[] = [
  "ALL",
  "INCOMPLETE",
  "REVIEWABLE",
  "READY_TO_PROMOTE",
  "ACTIVE",
  "INACTIVE",
];
const workspacePreferencesStorageKey =
  "orion.products.workspace.view-preferences.v2";

const uiCopy: Record<
  UiLanguage,
  {
    languageName: string;
    toggleLabel: string;
    productsWorkspace: string;
    serverBackedTruth: string;
    synced: string;
    startHere: string;
    workingDraftTruth: string;
    barcodeFlow: string;
    scanFirst: string;
    scanWedge: string;
    manualFallback: string;
    hideWorkingDraft: string;
    openWorkingDraft: string;
    hideHelp: string;
    openHelp: string;
    openSupportPanel: string;
    closeSupportPanel: string;
    startBarcodeCapture: string;
    refreshTruth: string;
    refreshWorkspace: string;
    workingDraft: string;
    unsavedChanges: string;
    noMissingRequirements: string;
    duplicateBarcodeDetected: string;
    saveWorkingDraft: string;
    reviewPromotion: string;
    hidePromotionControls: string;
    activate: string;
    deactivate: string;
    returnToPlanningMode: string;
    promotionConfirmation: string;
    promotionRecordedReviewable: string;
    whatWasPromoted: string;
    referenceAndFinalState: string;
    promotionExecutionControls: string;
    reviewExactSnapshot: string;
    promotionAcknowledgement: string;
    whatWillBePromoted: string;
    stateChange: string;
    promotionBlocked: string;
    confirmPromotionIntoCatalog: string;
    cancel: string;
    activationContinuity: string;
    activeNow: string;
    activationPending: string;
    activationBlocked: string;
    activationNotStarted: string;
    changedFromPromoted: string;
    nextStep: string;
    activateCatalogPrompt: string;
    activateBlockedPrompt: string;
    activationReadyPrompt: string;
    activationOnlyPrompt: string;
    nextActionActive: string;
    nextActionInactive: string;
    nextActionDraft: string;
    confirmationActionLabel: string;
    recoveryTitle: string;
    whatStayedUnchanged: string;
    retrySafety: string;
    refreshOrReopen: string;
    rollbackModel: string;
    changeLogLabel: string;
    activeLabel: string;
    pendingLabel: string;
    readyLabel: string;
    blockedLabel: string;
    promotionFlowSummary: string;
    promotionFlowAction: string;
    activationReadinessSummary: string;
    currentState: string;
    pendingState: string;
    changedState: string;
    activationNextStep: string;
    activeNowText: string;
    activationPendingText: string;
    activationBlockedText: string;
    activationReadyText: string;
  }
> = {
  EN: {
    languageName: "English",
    toggleLabel: "Arabic",
    productsWorkspace: "Product preparation desk",
    serverBackedTruth: "Catalog status",
    synced: "Synced",
    startHere: "Start here",
    workingDraftTruth: "Current preparation",
    barcodeFlow: "Barcode handling",
    scanFirst: "1. Scan first.",
    scanWedge: "2. If the scanner types as a keyboard wedge, keep the cursor in the barcode field.",
    manualFallback: "3. Manual typing is the fallback only.",
    hideWorkingDraft: "Hide working draft",
    openWorkingDraft: "Open working draft",
    hideHelp: "Hide help",
    openHelp: "Open help",
    openSupportPanel: "Open activity panel",
    closeSupportPanel: "Close activity panel",
    startBarcodeCapture: "Start barcode capture",
    refreshTruth: "Refresh list",
    refreshWorkspace: "Product preparation desk refreshed.",
    workingDraft: "Working draft",
    unsavedChanges: "Unsaved changes",
    noMissingRequirements: "No missing requirements",
    duplicateBarcodeDetected: "Duplicate barcode detected",
    saveWorkingDraft: "Save working draft",
    reviewPromotion: "Review promotion",
    hidePromotionControls: "Hide promotion controls",
    activate: "Activate",
    deactivate: "Deactivate",
    returnToPlanningMode: "Return to planning mode",
    promotionConfirmation: "Promotion confirmation",
    promotionRecordedReviewable: "Promotion recorded and ready for review.",
    whatWasPromoted: "What was promoted",
    referenceAndFinalState: "Reference and final state",
    promotionExecutionControls: "Promotion execution controls",
    reviewExactSnapshot: "Review the exact snapshot before promotion",
    promotionAcknowledgement:
      "Promotion is only confirmed after the operator reviews the current snapshot and acknowledges the state change.",
    whatWillBePromoted: "What will be promoted",
    stateChange: "State change",
    promotionBlocked: "Promotion blocked",
    confirmPromotionIntoCatalog: "Confirm promotion into catalog",
    cancel: "Cancel",
    activationContinuity: "Activation continuity",
    activeNow: "Active now",
    activationPending: "Pending activation",
    activationBlocked: "Activation blocked",
    activationNotStarted: "Not promoted yet",
    changedFromPromoted: "Changed from promoted",
    nextStep: "Next step",
    activateCatalogPrompt: "Activate the catalog product when launch approval is complete.",
    activateBlockedPrompt: "Activation is blocked until the catalog product is ready.",
    activationReadyPrompt: "Activation is ready once launch approval is complete.",
    activationOnlyPrompt: "Activation is the deliberate follow-through after promotion.",
    nextActionActive: "Deactivate only if launch should pause.",
    nextActionInactive: "Activate when the catalog product is truly launch-ready.",
    nextActionDraft: "Promote the draft before activation can begin.",
    confirmationActionLabel: "Promotion flows into activation as a two-step state change.",
    recoveryTitle: "Recovery guidance",
    whatStayedUnchanged: "What stayed unchanged",
    retrySafety: "Retry safety",
    refreshOrReopen: "Refresh or reopen",
    rollbackModel: "Rollback model: non-destructive compensation only",
    changeLogLabel: "Changed state",
    activeLabel: "Active",
    pendingLabel: "Pending",
    readyLabel: "Ready",
    blockedLabel: "Blocked",
    promotionFlowSummary:
      "Promotion records the inactive catalog product first. Activation is the explicit follow-through that turns it on after readiness clears.",
    promotionFlowAction: "Promotion confirmation is preserved so the operator can verify what changed before activation.",
    activationReadinessSummary:
      "The workspace now shows what is active, what is still pending, and what the next activation step is.",
    currentState: "Current state",
    pendingState: "Pending state",
    changedState: "Changed state",
    activationNextStep: "Next step",
    activeNowText: "Catalog product is active now.",
    activationPendingText: "Catalog product is listed but still inactive.",
    activationBlockedText: "Activation is blocked until the readiness gate clears.",
    activationReadyText: "Catalog product is ready to activate once launch approval is complete.",
  },
  AR: {
    languageName: "العربية",
    toggleLabel: "English",
    productsWorkspace: "منضدة تجهيز الأصناف",
    serverBackedTruth: "حالة الفهرس",
    synced: "تمت المزامنة",
    startHere: "ابدأ هنا",
    workingDraftTruth: "التحضير الحالي",
    barcodeFlow: "التعامل مع الباركود",
    scanFirst: "1. امسح أولاً.",
    scanWedge: "2. إذا كانت أداة المسح تكتب كلوحة مفاتيح، اترك المؤشر داخل حقل الباركود.",
    manualFallback: "3. الإدخال اليدوي هو الخيار الاحتياطي فقط.",
    hideWorkingDraft: "إخفاء المسودة العاملة",
    openWorkingDraft: "فتح المسودة العاملة",
    hideHelp: "إخفاء المساعدة",
    openHelp: "فتح المساعدة",
    openSupportPanel: "فتح لوحة النشاط",
    closeSupportPanel: "إغلاق لوحة النشاط",
    startBarcodeCapture: "بدء التقاط الباركود",
    refreshTruth: "تحديث القائمة",
    refreshWorkspace: "تم تحديث منضدة تجهيز الأصناف.",
    workingDraft: "المسودة العاملة",
    unsavedChanges: "تغييرات غير محفوظة",
    noMissingRequirements: "لا توجد متطلبات مفقودة",
    duplicateBarcodeDetected: "تم اكتشاف باركود مكرر",
    saveWorkingDraft: "حفظ المسودة العاملة",
    reviewPromotion: "مراجعة الترقية",
    hidePromotionControls: "إخفاء عناصر الترقية",
    activate: "تفعيل",
    deactivate: "إلغاء التفعيل",
    returnToPlanningMode: "العودة إلى وضع التخطيط",
    promotionConfirmation: "تأكيد الترقية",
    promotionRecordedReviewable: "تم تسجيل الترقية وأصبحت جاهزة للمراجعة",
    whatWasPromoted: "ما الذي تمت ترقيته",
    referenceAndFinalState: "المرجع والحالة النهائية",
    promotionExecutionControls: "عناصر تنفيذ الترقية",
    reviewExactSnapshot: "راجع اللقطة الدقيقة قبل الترقية",
    promotionAcknowledgement:
      "لا يتم تأكيد الترقية إلا بعد أن يراجع المشغل اللقطة الحالية ويؤكد تغيير الحالة.",
    whatWillBePromoted: "ما الذي ستتم ترقيته",
    stateChange: "تغيير الحالة",
    promotionBlocked: "تعذّر تنفيذ الترقية حالياً",
    confirmPromotionIntoCatalog: "تأكيد الترقية إلى الفهرس",
    cancel: "إلغاء",
    activationContinuity: "مسار التفعيل بعد الترقية",
    activeNow: "مفعل الآن",
    activationPending: "بانتظار التفعيل",
    activationBlocked: "التفعيل محجوب",
    activationNotStarted: "لم تتم الترقية بعد",
    changedFromPromoted: "ما تغيّر بعد الترقية",
    nextStep: "الخطوة التالية",
    activateCatalogPrompt: "فعّل المنتج في الفهرس عندما يكتمل اعتماد الإطلاق.",
    activateBlockedPrompt: "لا يمكن التفعيل حالياً حتى يكتمل شرط الجاهزية.",
    activationReadyPrompt: "المنتج جاهز للتفعيل بعد اكتمال اعتماد الإطلاق.",
    activationOnlyPrompt: "التفعيل هو المتابعة المقصودة بعد الترقية.",
    nextActionActive: "ألغِ التفعيل فقط إذا كان يجب إيقاف الإطلاق مؤقتاً.",
    nextActionInactive: "فعّل المنتج عندما يصبح جاهزاً فعلاً للإطلاق.",
    nextActionDraft: "رقِّ المسودة قبل أن يبدأ التفعيل.",
    confirmationActionLabel: "الترقية تنتقل إلى التفعيل كخطوتين واضحتين.",
    recoveryTitle: "إرشادات المعالجة والاستعادة",
    whatStayedUnchanged: "ما الذي بقي دون تغيير",
    retrySafety: "أمان إعادة المحاولة",
    refreshOrReopen: "حدّث الصفحة أو أعد فتح السجل",
    rollbackModel: "آلية الاستعادة: تصحيح غير هدّام فقط (من دون حذف بيانات)",
    changeLogLabel: "الحالة المتغيرة",
    activeLabel: "نشط",
    pendingLabel: "قيد الانتظار",
    readyLabel: "جاهز",
    blockedLabel: "محجوب",
    promotionFlowSummary:
      "الترقية تنشئ المنتج في الفهرس بوضع غير نشط أولاً. التفعيل هو المتابعة المقصودة التي تشغله بعد اكتمال الجاهزية.",
    promotionFlowAction:
      "يبقى تأكيد الترقية محفوظاً حتى يراجع المشغل ما الذي تغيّر قبل التفعيل.",
    activationReadinessSummary:
      "تعرض مساحة العمل الآن ما هو نشط، وما زال قيد الانتظار، وما هي الخطوة التالية للتفعيل.",
    currentState: "الحالة الحالية",
    pendingState: "الحالة قيد الانتظار",
    changedState: "الحالة المتغيرة",
    activationNextStep: "الخطوة التالية",
    activeNowText: "المنتج في الفهرس نشط الآن.",
    activationPendingText: "المنتج في الفهرس مسجل لكنه ما زال غير نشط.",
    activationBlockedText: "التفعيل متوقف مؤقتاً حتى استيفاء شرط الجاهزية.",
    activationReadyText: "المنتج جاهز للتفعيل بعد اكتمال اعتماد الإطلاق.",
  },
};

function getUiLocale(language: UiLanguage) {
  return language === "AR" ? "ar" : "en";
}

function localizeServerText(
  value: string | null | undefined,
  language: UiLanguage,
  fallbackArabic: string,
) {
  if (!value) {
    return language === "AR" ? fallbackArabic : "";
  }
  if (language !== "AR") {
    return value;
  }
  return /[A-Za-z]/.test(value) ? fallbackArabic : value;
}

function localizeTruthNote(note: string, language: UiLanguage) {
  if (language !== "AR") {
    return note;
  }

  const normalized = note.trim();
  const map: Record<string, string> = {
    "No sensitive token is written to the URL.":
      "لا يُكتب أي رمز حساس داخل عنوان URL.",
    "Working draft, worklists, and action log are shared for the active branch.":
      "المسودة العاملة وقوائم العمل وسجل الإجراءات مشتركة للفرع النشط.",
    "Mutating actions require a fresh concurrency marker so stale writes cannot silently overwrite teammate changes.":
      "تتطلب إجراءات التعديل علامة تزامن حديثة حتى لا تكتب البيانات القديمة فوق عمل الفريق بصمت.",
    "View-only preferences such as density or sort can remain local on this device.":
      "يمكن أن تبقى تفضيلات العرض فقط مثل الكثافة أو الترتيب محلية على هذا الجهاز.",
    "Reference products stay read-only in this workspace.":
      "تبقى المنتجات المرجعية للقراءة فقط داخل هذه المساحة.",
  };

  return map[normalized] ?? normalized;
}

function localizeDraftRequirement(item: string, language: UiLanguage) {
  if (language !== "AR") {
    return item;
  }

  const normalized = item.trim();
  const map: Record<string, string> = {
    "Add Name (AR)": "إضافة الاسم (عربي)",
    "Add Name (EN)": "إضافة الاسم (إنجليزي)",
    "Add strength": "إضافة التركيز",
    "Add pack": "إضافة العبوة",
    "Capture barcode": "التقاط الباركود",
    "Resolve duplicate barcode": "حل تعارض الباركود المكرر",
  };
  return map[normalized] ?? normalized;
}

function localizeMergeFieldLabel(
  field:
    | "nameAr"
    | "nameEn"
    | "barcode"
    | "strength"
    | "packSize"
    | "trackingMode",
  language: UiLanguage,
  fallback: string,
) {
  if (language !== "AR") {
    return fallback;
  }

  return {
    nameAr: "الاسم (عربي)",
    nameEn: "الاسم (إنجليزي)",
    barcode: "الباركود",
    strength: "التركيز",
    packSize: "العبوة",
    trackingMode: "التتبع",
  }[field];
}

function localizeApprovalDecisionLabel(label: string, language: UiLanguage) {
  if (language !== "AR") {
    return label;
  }

  const map: Record<string, string> = {
    "Submitted merge package for approval": "تم إرسال حزمة الدمج للاعتماد",
    "Approved merge package": "تم اعتماد حزمة الدمج",
    "Requested changes on merge package": "تم طلب تعديلات على حزمة الدمج",
    "Rejected merge package": "تم رفض حزمة الدمج",
  };
  return map[label.trim()] ?? label;
}

function localizeHistoryOrigin(origin: "Workspace" | "Inspector" | "Queue", language: UiLanguage) {
  if (language !== "AR") {
    return origin;
  }
  return {
    Workspace: "مساحة العمل",
    Inspector: "لوحة الدعم",
    Queue: "الانتظار",
  }[origin];
}

function localizeLifecycleState(value: string, language: UiLanguage) {
  if (language !== "AR") {
    return value;
  }

  const normalized = value.trim();
  const map: Record<string, string> = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    active: "نشط",
    inactive: "غير نشط",
    READY_TO_PROMOTE: "جاهز للترقية",
    PROMOTED_INACTIVE: "مرفّع غير نشط",
    PROMOTED_ACTIVE: "مرفّع نشط",
  };
  return map[normalized] ?? normalized;
}

// UI-owned and helper-generated copy only.
// Contract-backed operational states are resolved before they reach this layer.
function localizeOperationalText(
  value: string | null | undefined,
  language: UiLanguage,
  fallbackArabic?: string,
) {
  if (!value) {
    return language === "AR" ? (fallbackArabic ?? "") : "";
  }
  if (language !== "AR") {
    return value;
  }

  const normalized = value.trim();
  const residualFallback = resolveProductsResidualFallback(
    normalized,
    language,
  );
  if (residualFallback) {
    return residualFallback;
  }

  const changedLineMatch = normalized.match(
    /^(Name \(AR\)|Name \(EN\)|Barcode|Strength|Pack|Tracking):\s+(draft value promoted|reference value retained|apply draft value|keep reference value|decision required)$/i,
  );
  if (changedLineMatch) {
    const fieldRaw = changedLineMatch[1];
    const actionRaw = changedLineMatch[2].toLowerCase();
    const fieldKey =
      fieldRaw === "Name (AR)"
        ? "nameAr"
        : fieldRaw === "Name (EN)"
          ? "nameEn"
          : fieldRaw === "Barcode"
            ? "barcode"
            : fieldRaw === "Strength"
              ? "strength"
              : fieldRaw === "Pack"
                ? "packSize"
                : ("trackingMode" as const);
    const fieldLabel = localizeMergeFieldLabel(fieldKey, language, fieldRaw);
    const actionLabel =
      {
        "draft value promoted": "تمت ترقية قيمة المسودة",
        "reference value retained": "تم الإبقاء على قيمة المرجع",
        "apply draft value": "اعتماد قيمة المسودة",
        "keep reference value": "الإبقاء على قيمة المرجع",
        "decision required": "قرار مطلوب",
      }[actionRaw] ?? changedLineMatch[2];
    return `${fieldLabel}: ${actionLabel}`;
  }

  const missingMatch = normalized.match(/^Still missing:\s*(.+)\.$/);
  if (missingMatch) {
    const items = missingMatch[1]
      .split(",")
      .map((item) => localizeDraftRequirement(item.trim(), language));
    return `لا تزال المتطلبات الناقصة: ${items.join("، ")}.`;
  }

  const missingReqMatch = normalized.match(/^Missing requirements:\s*(.+)$/);
  if (missingReqMatch) {
    const items = missingReqMatch[1]
      .split(",")
      .map((item) => localizeDraftRequirement(item.trim(), language));
    return `متطلبات ناقصة: ${items.join("، ")}.`;
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

  const completeItemMatch = normalized.match(/^Complete\s+(.+)\s+before retrying\.$/);
  if (completeItemMatch) {
    return `أكمل ${localizeDraftRequirement(completeItemMatch[1], language)} قبل إعادة المحاولة.`;
  }

  const approvalStatusMatch = normalized.match(/^Approval status is\s+([A-Z_]+)\.$/);
  if (approvalStatusMatch) {
    const status = approvalStatusMatch[1];
    const localizedStatus =
      {
        NOT_REQUIRED: "غير مطلوب",
        PENDING_REVIEW: "قيد المراجعة",
        APPROVED: "معتمد",
        REJECTED: "مرفوض",
        CHANGES_REQUESTED: "تعديلات مطلوبة",
      }[status] ?? status;
    return `حالة الاعتماد: ${localizedStatus}.`;
  }

  const runMatch = normalized.match(/^Run \"(.+)\" again only if it is still correct\.$/);
  if (runMatch) {
    const actionLabel =
      runMatch[1].trim().toLowerCase() === "activate the catalog product"
        ? "تفعيل منتج الفهرس"
        : runMatch[1];
    return `نفّذ "${actionLabel}" مرة أخرى فقط إذا بقي مناسبًا.`;
  }

  const repeatMatch = normalized.match(/^Repeat \"(.+)\" only after reviewing the latest state\.$/);
  if (repeatMatch) {
    const actionLabel =
      repeatMatch[1].trim().toLowerCase() === "activate the catalog product"
        ? "تفعيل منتج الفهرس"
        : repeatMatch[1];
    return `أعد "${actionLabel}" فقط بعد مراجعة أحدث حالة.`;
  }

  const draftUpdatedMatch = normalized.match(/^(.+)\s+updated the working draft at\s+(.+)\.$/);
  if (draftUpdatedMatch) {
    return `${draftUpdatedMatch[1]} حدّث المسودة العاملة عند ${draftUpdatedMatch[2]}.`;
  }

  const catalogUpdatedMatch = normalized.match(
    /^Catalog product \"(.+)\" was updated at\s+(.+)\.$/,
  );
  if (catalogUpdatedMatch) {
    return `تم تحديث منتج الفهرس "${catalogUpdatedMatch[1]}" عند ${catalogUpdatedMatch[2]}.`;
  }

  const barcodeAssignedMatch = normalized.match(
    /^Barcode\s+(.+)\s+is already assigned to \"(.+)\" \((active|inactive)\)\.$/,
  );
  if (barcodeAssignedMatch) {
    const statusLabel = barcodeAssignedMatch[3] === "active" ? "نشط" : "غير نشط";
    return `الباركود ${barcodeAssignedMatch[1]} مسجل مسبقًا للمنتج "${barcodeAssignedMatch[2]}" (${statusLabel}).`;
  }

  return /[A-Za-z]/.test(normalized) && fallbackArabic
    ? fallbackArabic
    : normalized;
}

function resolveContractMessage(
  contract: WorkspaceMessageContract | null | undefined,
  key: keyof WorkspaceMessageContract,
  language: UiLanguage,
  fallbackArabic: string,
) {
  if (!contract) {
    return null;
  }
  return resolveProductsCriticalMessage(contract, key, language, fallbackArabic);
}

function resolveActivationContractMessage(
  contract: WorkspaceMessageContract | null | undefined,
  key: keyof ActivationSummaryContract,
  language: UiLanguage,
  fallbackArabic: string,
) {
  if (!contract?.activationSummary) {
    return null;
  }
  return resolveServerLocalizedMessage(
    contract.activationSummary[key],
    language,
    fallbackArabic,
  );
}

function resolveConflictContractSummary(
  conflict: WorkspaceConflictPayload | null,
  language: UiLanguage,
) {
  if (!conflict?.messageContract) {
    return null;
  }

  if (conflict.conflictType === "ACTIVATION_PREREQUISITES_NOT_MET") {
    return resolveContractMessage(
      conflict.messageContract,
      "activationBlocked",
      language,
      "التفعيل محجوب حتى تصبح الجاهزية مكتملة.",
    );
  }
  if (conflict.conflictType === "ACTIVATION_ALREADY_EXECUTED") {
    return resolveContractMessage(
      conflict.messageContract,
      "alreadyActive",
      language,
      "منتج الفهرس نشط بالفعل.",
    );
  }
  if (conflict.conflictType === "MERGE_DECISIONS_REQUIRED") {
    return resolveContractMessage(
      conflict.messageContract,
      "mergeSummary",
      language,
      "قرارات الدمج مطلوبة قبل متابعة الإجراء.",
    );
  }
  if (conflict.conflictType === "APPROVAL_REQUIRED") {
    return resolveContractMessage(
      conflict.messageContract,
      "approvalSummary",
      language,
      "حالة الاعتماد لا تسمح بمتابعة الإجراء.",
    );
  }
  return null;
}

function getLocalizedLabel<T extends string>(
  language: UiLanguage,
  values: Record<UiLanguage, Record<T, string>>,
  key: T,
) {
  return values[language][key];
}

const filterLabels: Record<
  UiLanguage,
  Record<WorkspaceFilter, string>
> = {
  EN: {
    ALL: "All products",
    INCOMPLETE: "Needs details",
    REVIEWABLE: "Ready for review",
    READY_TO_PROMOTE: "Ready for catalog",
    ACTIVE: "Active",
    INACTIVE: "Inactive",
  },
  AR: {
    ALL: "كل المنتجات",
    INCOMPLETE: "تحتاج تفاصيل",
    REVIEWABLE: "جاهزة للمراجعة",
    READY_TO_PROMOTE: "جاهزة للفهرس",
    ACTIVE: "نشطة",
    INACTIVE: "غير نشطة",
  },
};

const filterDescriptions: Record<
  UiLanguage,
  Record<WorkspaceFilter, string>
> = {
  EN: {
    ALL: "Working draft and read-only references.",
    INCOMPLETE: "Required product details are still missing.",
    REVIEWABLE: "Core draft fields are saved; barcode is still pending.",
    READY_TO_PROMOTE: "Draft can move into catalog after review.",
    ACTIVE: "Catalog products currently active.",
    INACTIVE: "Catalog products currently inactive.",
  },
  AR: {
    ALL: "المسودة العاملة والمراجع للقراءة فقط.",
    INCOMPLETE: "ما زالت تفاصيل المنتج الإلزامية مفقودة.",
    REVIEWABLE: "تم حفظ الحقول الأساسية، والباركود ما زال بانتظار الإدخال.",
    READY_TO_PROMOTE: "يمكن نقل المسودة إلى الفهرس بعد المراجعة.",
    ACTIVE: "منتجات الفهرس النشطة حالياً.",
    INACTIVE: "منتجات الفهرس غير النشطة حالياً.",
  },
};

const trackingModeLabelsByLanguage: Record<
  UiLanguage,
  Record<TrackingMode, string>
> = {
  EN: {
    NONE: "None",
    EXPIRY_ONLY: "Expiry only",
    LOT_EXPIRY: "Lot + expiry",
  },
  AR: {
    NONE: "بدون",
    EXPIRY_ONLY: "انتهاء الصلاحية",
    LOT_EXPIRY: "تشغيلة + انتهاء الصلاحية",
  },
};

const initialDraftForm: DraftForm = {
  nameAr: "",
  nameEn: "",
  barcode: "",
  strength: "",
  packSize: "",
  trackingMode: "NONE",
};

function readWorkspacePreferences(): WorkspacePreferences {
  if (typeof window === "undefined") {
    return { density: "COMFORTABLE", sortKey: "READINESS" };
  }

  try {
    const raw = window.localStorage.getItem(workspacePreferencesStorageKey);
    if (!raw) {
      return { density: "COMFORTABLE", sortKey: "READINESS" };
    }

    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    return {
      density: parsed.density === "COMPACT" ? "COMPACT" : "COMFORTABLE",
      sortKey:
        parsed.sortKey === "NAME" ||
        parsed.sortKey === "SOURCE" ||
        parsed.sortKey === "READINESS"
          ? parsed.sortKey
          : "READINESS",
    };
  } catch {
    return { density: "COMFORTABLE", sortKey: "READINESS" };
  }
}

function writeWorkspacePreferences(preferences: WorkspacePreferences) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      workspacePreferencesStorageKey,
      JSON.stringify(preferences),
    );
  } catch {
    // Local view preferences are intentionally best-effort only.
  }
}

function formatRelativeTime(value: string, locale: string = "en") {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Time unavailable";
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffSeconds) < 60) return formatter.format(diffSeconds, "second");

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function formatExactDateTime(value: string, locale: string = "en") {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(timestamp);
}

function getDisplayName(record: WorkspaceRecord, language: UiLanguage = "EN") {
  if (record.source === "draft") {
    return language === "AR"
      ? record.nameAr || record.nameEn || "المسودة العاملة"
      : record.nameEn || record.nameAr || "Working draft";
  }

  return language === "AR"
    ? record.nameAr || record.nameEn || "منتج مرجعي"
    : record.nameEn || record.nameAr || "Reference product";
}

function getStatusLabel(status: DraftStatus, language: UiLanguage = "EN") {
  return language === "AR"
    ? {
        EMPTY: "لم يبدأ",
        INCOMPLETE: "تحتاج تفاصيل",
        REVIEWABLE: "جاهزة للمراجعة",
        READY_TO_PROMOTE: "جاهزة للفهرس",
        PROMOTED_INACTIVE: "مسجلة في الفهرس",
        PROMOTED_ACTIVE: "نشطة في الفهرس",
      }[status]
    : {
        EMPTY: "Not started",
        INCOMPLETE: "Needs details",
        REVIEWABLE: "Ready for review",
        READY_TO_PROMOTE: "Ready for catalog",
        PROMOTED_INACTIVE: "Catalog listed",
        PROMOTED_ACTIVE: "Catalog active",
      }[status];
}

function getStatusTone(status: DraftStatus) {
  return {
    EMPTY: "border-slate-700 bg-slate-900 text-slate-200",
    INCOMPLETE: "border-slate-700 bg-slate-900 text-slate-200",
    REVIEWABLE: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
    READY_TO_PROMOTE: "border-sky-500/40 bg-sky-500/10 text-sky-200",
    PROMOTED_INACTIVE: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    PROMOTED_ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  }[status];
}

function getSourceTone(source: WorkspaceRecord["source"]) {
  return source === "draft"
    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
    : "border-slate-700 bg-slate-900 text-slate-200";
}

function getApprovalLabel(status: ApprovalStatus, language: UiLanguage = "EN") {
  return language === "AR"
    ? {
        NOT_REQUIRED: "غير مطلوب",
        PENDING_REVIEW: "بانتظار المراجعة",
        APPROVED: "معتمد",
        REJECTED: "مرفوض",
        CHANGES_REQUESTED: "مطلوب تعديل",
      }[status]
    : {
        NOT_REQUIRED: "Not required",
        PENDING_REVIEW: "Pending review",
        APPROVED: "Approved",
        REJECTED: "Rejected",
        CHANGES_REQUESTED: "Changes requested",
      }[status];
}

function getApprovalTone(status: ApprovalStatus) {
  return {
    NOT_REQUIRED: "border-slate-700 bg-slate-900 text-slate-200",
    PENDING_REVIEW: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    APPROVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
    REJECTED: "border-rose-500/40 bg-rose-500/10 text-rose-100",
    CHANGES_REQUESTED: "border-orange-500/40 bg-orange-500/10 text-orange-100",
  }[status];
}

function getExpectedDecisionLabel(
  value: HandoffExpectedDecision,
  language: UiLanguage = "EN",
) {
  return language === "AR"
    ? {
        REVIEW_MERGE_DECISIONS: "مراجعة قرارات الدمج",
        APPROVE_MERGE: "اعتماد حزمة الدمج",
        APPLY_CHANGES: "تطبيق التعديلات المطلوبة",
        PROMOTE_DRAFT: "ترقية المسودة",
        NONE: "لا يوجد قرار معلق",
      }[value]
    : {
        REVIEW_MERGE_DECISIONS: "Review merge decisions",
        APPROVE_MERGE: "Approve merge package",
        APPLY_CHANGES: "Apply requested changes",
        PROMOTE_DRAFT: "Promote draft",
        NONE: "No pending decision",
      }[value];
}

function getPromotionExecutionPlan(
  workspace: WorkspaceResponse | null,
  draftDirty: boolean,
  barcodeConflict: DuplicateBarcodeConflictPayload | null,
  language: UiLanguage = "EN",
) {
  if (!workspace) {
    return null;
  }

  const blockers: string[] = [];
  const draft = workspace.draft;

  if (!draft.readiness.canPromote) {
    blockers.push(
      draft.readiness.missingForCatalog[0] ??
        (language === "AR"
          ? "أكمل بيانات المسودة أولاً."
          : "Complete the draft first."),
    );
  }
  if (draftDirty) {
    blockers.push(
      language === "AR"
        ? "احفظ المسودة العاملة قبل تنفيذ الترقية."
        : "Save the working draft before promoting.",
    );
  }
  if (barcodeConflict) {
    blockers.push(
      language === "AR"
        ? `عالج تعارض الباركود ${barcodeConflict.barcode} أولاً.`
        : `Resolve the duplicate barcode ${barcodeConflict.barcode} first.`,
    );
  }
  if ((workspace.mergeDecision.pendingCount ?? 0) > 0) {
    blockers.push(
      language === "AR"
        ? "أكمل جميع قرارات الدمج قبل تنفيذ الترقية."
        : "Finish every merge decision before promoting.",
    );
  }
  if (
    workspace.approval.required &&
    workspace.approval.status !== "APPROVED"
  ) {
    blockers.push(
      language === "AR"
        ? "يلزم تسجيل الاعتماد قبل تشغيل الترقية."
        : "Approval is required before promotion can run.",
    );
  }

  const reference = workspace.references.find(
    (record) => record.id === draft.basedOnProductId,
  );
  const apiPlan = workspace.promotion.executionPlan;
  const snapshotLabel =
    getDisplayName(draft, language) ||
    (language === "AR" ? "لقطة المسودة العاملة" : "Working draft snapshot");
  const referenceLabel = reference
    ? getDisplayName(reference, language) || reference.barcode
    : draft.basedOnProductId
      ? language === "AR"
        ? "المرجع المرتبط"
        : "Linked reference"
      : language === "AR"
        ? "لا يوجد مرجع مرتبط"
        : "No linked reference";

  return {
    canExecute:
      blockers.length === 0 &&
      draft.status === "READY_TO_PROMOTE" &&
      !draft.catalogProductId &&
      workspace.promotion.ready,
    snapshotLabel,
    referenceLabel,
    promotedStateLabel:
      apiPlan.targetState === "PROMOTED_INACTIVE"
        ? language === "AR"
          ? "مسجل في الفهرس وغير نشط"
          : "Catalog listed and inactive"
        : apiPlan.targetState,
    changedStateLabel:
      language === "AR"
        ? "الترقية ستنشئ المنتج في الفهرس بوضع غير نشط أولاً."
        : apiPlan.summary,
    blockers,
    nextStep:
      blockers.length > 0
        ? language === "AR"
          ? "عالج العوائق أعلاه ثم أعد فتح عناصر الترقية."
          : "Resolve the blockers above, then reopen promotion controls."
        : localizeOperationalText(
            workspace.promotion.nextStep,
            language,
            "أكد الترقية عندما تبدو اللقطة صحيحة.",
          ) ||
          (language === "AR"
            ? "أكد الترقية عندما تبدو اللقطة صحيحة."
            : "Confirm promotion when the snapshot looks correct."),
    confirmedPlan: {
      mode: apiPlan.mode,
      targetState: apiPlan.targetState,
      items: apiPlan.items.map((item) => ({
        fieldKey: item.fieldKey,
        source: item.source,
        value: item.value,
        label: localizeMergeFieldLabel(item.fieldKey, language, item.label),
      })),
    },
  } satisfies PromotionExecutionPlan;
}

function getPromotionConfirmation(
  workspace: WorkspaceResponse | null,
  language: UiLanguage = "EN",
) {
  if (!workspace) {
    return null;
  }

  const confirmation = workspace.promotion.confirmation;
  if (!confirmation) {
    return null;
  }

  const promotedProduct = workspace.references.find((record) => {
    return record.id === confirmation.promotedProductId;
  });
  const referenceProduct = workspace.references.find(
    (record) => record.id === confirmation.basedOnProductId,
  );

  return {
    promotedAt: confirmation.promotedAt,
    productLabel:
      (language === "AR"
        ? promotedProduct?.nameAr || promotedProduct?.nameEn
        : promotedProduct?.nameEn || promotedProduct?.nameAr) ||
      (language === "AR"
        ? workspace.draft.nameAr || workspace.draft.nameEn
        : workspace.draft.nameEn || workspace.draft.nameAr) ||
      (language === "AR" ? "المنتج المُرقّى" : "Promoted product"),
    referenceLabel:
      (language === "AR"
        ? referenceProduct?.nameAr || referenceProduct?.nameEn
        : referenceProduct?.nameEn || referenceProduct?.nameAr) ||
      referenceProduct?.barcode ||
      (confirmation.basedOnProductId
        ? language === "AR"
          ? "مرجع مرتبط"
          : "Linked reference"
        : language === "AR"
          ? "لا يوجد مرجع مرتبط"
          : "No linked reference"),
    stateChangeLabel: confirmation.changed
      .map((item) => localizeOperationalText(item, language))
      .join(" | "),
    currentStateLabel: localizeOperationalText(
      confirmation.activeState,
      language,
      "حالة المنتج بعد الترقية محفوظة.",
    ),
    finalStateLabel: localizeOperationalText(
      confirmation.finalState,
      language,
      "اكتملت الترقية وبقيت الحالة النهائية محفوظة.",
    ),
    nextStep: localizeOperationalText(
      confirmation.nextStep,
      language,
      "راجع الحالة ثم نفّذ الخطوة التالية.",
    ),
  } satisfies PromotionConfirmationSummary;
}

function getPromotionRecoverySummary(
  conflict: WorkspaceConflictPayload | null,
  language: UiLanguage = "EN",
) {
  if (!conflict) {
    return null;
  }

  if (conflict.recovery) {
    const unchangedState = conflict.recovery.unchangedState;
    const guidance = conflict.recovery.guidance;
    const hasEnglishContent = /[A-Za-z]/.test(guidance);
    const contractGuidance = resolveContractMessage(
      conflict.messageContract,
      "recoveryGuidance",
      language,
      "حدّث مساحة العمل، راجع أحدث حالة، ثم أعد المحاولة بعد إزالة العائق.",
    );
    const localizedUnchangedState =
      language === "AR"
        ? /no catalog change|catalog was not changed|no promotion change|did not save/i.test(
            unchangedState,
          )
          ? "لم يتم اعتماد أي تغيير على المسودة أو الفهرس."
          : unchangedState
        : unchangedState;
    const localizedGuidance =
      language === "AR"
        ? hasEnglishContent
          ? "حدّث مساحة العمل، راجع الحالة الحالية، ثم أعد المحاولة فقط بعد إزالة العائق."
          : guidance
        : guidance;
    const nextStep = contractGuidance ?? localizedGuidance;

    return {
      unchanged: localizedUnchangedState,
      retrySafety: conflict.recovery.retrySafe
        ? language === "AR"
          ? "إعادة المحاولة آمنة بعد إزالة العائق المذكور."
          : "Retry is safe after the listed blocker is cleared."
        : language === "AR"
          ? "إعادة المحاولة غير آمنة إلى أن تُحل العوائق."
          : "Retry is unsafe until blockers are resolved.",
      refreshOrReopen:
        conflict.recovery.refreshRequired || conflict.recovery.reopenRequired
          ? language === "AR"
            ? "حدّث وأعد فتح سياق مساحة العمل قبل إعادة المحاولة."
            : "Refresh and reopen the workspace context before retrying."
          : language === "AR"
            ? "التحديث اختياري لهذا العائق."
            : "Refresh is optional for this blocker.",
      nextStep,
    } satisfies PromotionRecoverySummary;
  }

  switch (conflict.conflictType) {
    case "STALE_DRAFT":
      return {
        unchanged:
          language === "AR"
            ? "لم يحفظ الخادم الترقية. بقيت لقطة المسودة الأخيرة كما هي."
            : "The server did not save your promotion. The latest draft snapshot remains unchanged.",
        retrySafety:
          language === "AR"
            ? "إعادة المحاولة آمنة بعد التحديث ومراجعة أحدث حالة للمسودة."
            : "Retry is safe after you refresh and review the newest draft state.",
        refreshOrReopen:
          language === "AR"
            ? "حدّث مساحة العمل قبل إعادة محاولة عنصر الترقية."
            : "Refresh the workspace before retrying the promotion control.",
        nextStep:
          language === "AR"
            ? "أعد تحميل مساحة العمل، راجع اللقطة المحدثة، ثم أكد من جديد."
            : "Reload the workspace, review the updated snapshot, then confirm again.",
      } satisfies PromotionRecoverySummary;
    case "STALE_CATALOG_PRODUCT":
      return {
        unchanged:
          language === "AR"
            ? "لم تتم الكتابة فوق منتج الفهرس المرتبط بهذه المحاولة."
            : "The linked catalog product was not overwritten by this attempt.",
        retrySafety:
          language === "AR"
            ? "إعادة المحاولة آمنة فقط بعد إعادة فتح أحدث حالة للمنتج المرتبط."
            : "Retry is safe only after you reopen the latest linked product state.",
        refreshOrReopen:
          language === "AR"
            ? "حدّث مساحة العمل وأعد فتح المرجع المرتبط قبل المحاولة مرة أخرى."
            : "Refresh the workspace and reopen the linked reference before trying again.",
        nextStep:
          language === "AR"
            ? "قارن المرجع الحالي بالمسودة، ثم أعد المحاولة فقط إذا بقي التطابق."
            : "Compare the current reference with the draft, then retry only if it still matches.",
      } satisfies PromotionRecoverySummary;
    case "MERGE_DECISIONS_REQUIRED":
      return {
        unchanged:
          language === "AR"
            ? "لم تُعتمد أي ترقية. بقيت حالة المسودة والمرجع كما هي."
            : "No promotion was committed. Draft and reference state stay as they were.",
        retrySafety:
          language === "AR"
            ? "إعادة المحاولة غير آمنة بعد. أكمل كل قرارات الدمج أولاً."
            : "Retry is not safe yet. Complete every merge decision first.",
        refreshOrReopen:
          language === "AR"
            ? "التحديث اختياري؛ العائق هو قرارات الدمج غير المكتملة."
            : "Refresh is optional; the blocker is incomplete merge decisions.",
        nextStep:
          language === "AR"
            ? "أنهِ لوحة قرارات الدمج ثم أعد فتح عناصر الترقية."
            : "Finish the merge decisions panel, then reopen promotion controls.",
      } satisfies PromotionRecoverySummary;
    case "APPROVAL_REQUIRED":
      return {
        unchanged:
          language === "AR"
            ? "لم تُعتمد أي ترقية. بقيت حالة الاعتماد والفهرس من دون تغيير."
            : "No promotion was committed. Approval and catalog state remain unchanged.",
        retrySafety:
          language === "AR"
            ? "إعادة المحاولة غير آمنة حتى تتم الموافقة على حزمة الدمج."
            : "Retry is not safe until the merge package is approved.",
        refreshOrReopen:
          language === "AR"
            ? "التحديث اختياري؛ يجب تسجيل الاعتماد أولاً."
            : "Refresh is optional; approval must be recorded first.",
        nextStep:
          language === "AR"
            ? "سجل قرار الاعتماد ثم ارجع إلى عناصر الترقية."
            : "Record the approval decision, then return to promotion controls.",
      } satisfies PromotionRecoverySummary;
    case "DUPLICATE_BARCODE":
      return {
        unchanged:
          language === "AR"
            ? "لم يتغير الفهرس. ما يزال مالك الباركود الموجود في مكانه."
            : "The catalog was not changed. The existing barcode owner still remains in place.",
        retrySafety:
          language === "AR"
            ? "إعادة المحاولة آمنة فقط بعد اختيار باركود مختلف أو فتح المنتج الموجود."
            : "Retry is only safe after you choose a different barcode or open the existing product.",
        refreshOrReopen:
          language === "AR"
            ? "حدّث مساحة العمل إذا كنت تحتاج أحدث قائمة للباركود قبل المحاولة مجدداً."
            : "Refresh the workspace if you need the latest barcode list before trying again.",
        nextStep:
          language === "AR"
            ? "استخدم باركوداً مختلفاً أو افتح المنتج الموجود بدلاً من فرض التكرار."
            : "Use a different barcode or open the existing product instead of forcing a duplicate.",
      } satisfies PromotionRecoverySummary;
    default:
      return {
        unchanged:
          language === "AR"
            ? "لم تُعتمد أي تغييرات على مساحة العمل أو الفهرس."
            : "No promotion change was committed to the workspace or catalog.",
        retrySafety:
          language === "AR"
            ? "أعد المحاولة فقط بعد التأكد من زوال العائق."
            : "Retry only after you have confirmed the blocker has been cleared.",
        refreshOrReopen:
          language === "AR"
            ? "حدّث مساحة العمل إذا كانت اللقطة قد تغيّرت أثناء التدفق."
            : "Refresh the workspace if the snapshot may have changed mid-flow.",
        nextStep:
          language === "AR"
            ? conflict.nextSteps?.[0] ?? "راجع العائق وأعد المحاولة بعد حله."
            : conflict.nextSteps?.[0] ?? "Review the blocker and try again once it is resolved.",
      } satisfies PromotionRecoverySummary;
  }
}

function matchesFilter(record: WorkspaceRecord, filter: WorkspaceFilter) {
  if (filter === "ALL") return true;
  if (filter === "INCOMPLETE") {
    return record.status === "EMPTY" || record.status === "INCOMPLETE";
  }
  if (filter === "REVIEWABLE") return record.status === "REVIEWABLE";
  if (filter === "READY_TO_PROMOTE") {
    return (
      record.status === "READY_TO_PROMOTE" ||
      record.status === "PROMOTED_INACTIVE" ||
      record.status === "PROMOTED_ACTIVE"
    );
  }
  if (filter === "ACTIVE") return record.status === "PROMOTED_ACTIVE";
  return record.status === "PROMOTED_INACTIVE";
}

function matchesSearch(
  record: WorkspaceRecord,
  query: string,
  language: UiLanguage = "EN",
) {
  if (!query) return true;

  return [
    getDisplayName(record, language),
    record.nameAr,
    record.nameEn,
    record.barcode,
    record.strength,
    record.packSize,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function getStatusRank(status: DraftStatus) {
  return {
    EMPTY: 0,
    INCOMPLETE: 1,
    REVIEWABLE: 2,
    READY_TO_PROMOTE: 3,
    PROMOTED_INACTIVE: 4,
    PROMOTED_ACTIVE: 5,
  }[status];
}

function sortRecords(
  records: WorkspaceRecord[],
  sortKey: SortKey,
  language: UiLanguage = "EN",
) {
  return [...records].sort((left, right) => {
    if (sortKey === "READINESS") {
      const delta = getStatusRank(left.status) - getStatusRank(right.status);
      if (delta !== 0) return delta;
    }

    if (sortKey === "SOURCE") {
      const leftSource = sourceLabelsByLanguage[language][left.source];
      const rightSource = sourceLabelsByLanguage[language][right.source];
      const delta = leftSource.localeCompare(rightSource, getUiLocale(language), {
        sensitivity: "base",
      });
      if (delta !== 0) return delta;
    }

    return getDisplayName(left, language).localeCompare(
      getDisplayName(right, language),
      getUiLocale(language),
      {
        sensitivity: "base",
      },
    );
  });
}

function getRecordNextStep(
  record: WorkspaceRecord,
  language: UiLanguage = "EN",
) {
  if (record.source === "draft") {
    if (language === "AR" && /[A-Za-z]/.test(record.readiness.nextStep)) {
      return "راجع جاهزية المسودة ثم أكمل الخطوة التالية.";
    }
    return record.readiness.nextStep;
  }

  return record.status === "PROMOTED_ACTIVE"
    ? language === "AR"
      ? "المرجع للقراءة فقط وهو نشط بالفعل"
      : "Read-only reference already active"
    : language === "AR"
      ? "المرجع للقراءة فقط ومسجل لكنه غير نشط"
      : "Read-only reference listed but inactive";
}

class WorkspaceApiError extends Error {
  readonly conflict: WorkspaceConflictPayload | null;

  constructor(message: string, conflict: WorkspaceConflictPayload | null = null) {
    super(message);
    this.name = "WorkspaceApiError";
    this.conflict = conflict;
  }
}

function toDraftConcurrencyPayload(draft: DraftPayload) {
  return {
    expectedDraftUpdatedAt: draft.concurrency.expectedDraftUpdatedAt,
    ...(draft.concurrency.expectedCatalogUpdatedAt
      ? {
          expectedCatalogUpdatedAt: draft.concurrency.expectedCatalogUpdatedAt,
        }
      : {}),
    ...(draft.concurrency.expectedBasedOnUpdatedAt
      ? {
          expectedBasedOnUpdatedAt: draft.concurrency.expectedBasedOnUpdatedAt,
        }
      : {}),
  };
}

export default function ProductsPage() {
  const operatorSession = useOperatorSession();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WorkspaceFilter>("ALL");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [focusedKey, setFocusedKey] = useState<string>("draft");
  const [draftForm, setDraftForm] = useState<DraftForm>(initialDraftForm);
  const [draftDirty, setDraftDirty] = useState(false);
  const [density, setDensity] = useState<DensityMode>("COMFORTABLE");
  const [sortKey, setSortKey] = useState<SortKey>("READINESS");
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WorkspaceConflictPayload | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [language, setLanguage] = useState<UiLanguage>("EN");
  const languageRef = useRef<UiLanguage>("EN");
  const [worklistName, setWorklistName] = useState("");
  const [mergeDecisionDraft, setMergeDecisionDraft] = useState<
    Partial<Record<MergeDiffPayload["field"], MergeDecisionValue>>
  >({});
  const [mergeRationale, setMergeRationale] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [isPromotionReviewOpen, setIsPromotionReviewOpen] = useState(false);
  const [promotionReviewed, setPromotionReviewed] = useState(false);
  const [isDraftOpen, setIsDraftOpen] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("record");
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const preferences = readWorkspacePreferences();
    setDensity(preferences.density);
    setSortKey(preferences.sortKey);
  }, []);

  useEffect(() => {
    writeWorkspacePreferences({ density, sortKey });
  }, [density, sortKey]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (operatorSession.status === "ready") {
      setSession({
        accessToken: operatorSession.accessToken,
        tenantId: operatorSession.tenantId,
        branchId: operatorSession.branchId,
        apiBase: operatorSession.apiBase,
        user: operatorSession.user,
      });
      setError(null);
      return;
    }

    if (operatorSession.status === "error") {
      setSession(null);
      setBusyAction(null);
      setError(operatorSession.error);
      return;
    }

    setBusyAction("session");
  }, [
    operatorSession.accessToken,
    operatorSession.apiBase,
    operatorSession.branchId,
    operatorSession.error,
    operatorSession.status,
    operatorSession.tenantId,
    operatorSession.user,
  ]);

  useEffect(() => {
    if (!session) return;
    const currentSession = session;

    let cancelled = false;

    async function loadWorkspaceAfterSession() {
      setBusyAction("refresh");
      setError(null);
      setConflict(null);

      try {
        const response = await fetch(
          `${currentSession.apiBase}/products/workspace`,
          {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.accessToken}`,
            "x-tenant-id": currentSession.tenantId,
          },
          cache: "no-store",
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | WorkspaceResponse
          | { message?: string }
          | null;

        if (!response.ok || payload == null || !("draft" in payload)) {
          throw new Error(
            payload && "message" in payload && payload.message
              ? payload.message
              : languageRef.current === "AR"
                ? "تعذر تحديث مساحة عمل المنتجات."
                : "Failed to refresh the products workspace.",
          );
        }

        if (!cancelled) {
          setWorkspace(payload);
          setNotice({
            kind: "success",
            message:
              languageRef.current === "AR"
                ? "تم تحميل مساحة المنتجات المدعومة من الخادم."
                : "Product preparation desk refreshed.",
          });
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : languageRef.current === "AR"
                ? "تعذر تحديث مساحة عمل المنتجات."
                : "Failed to refresh the products workspace.",
          );
        }
      } finally {
        if (!cancelled) {
          setBusyAction(null);
        }
      }
    }

    void loadWorkspaceAfterSession();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const recordStates = new Map(
    (workspace?.recordStates ?? []).map((state) => [state.recordKey, state]),
  );
  const allRecords: WorkspaceRecord[] = workspace
    ? [workspace.draft, ...workspace.references]
    : [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRecords = sortRecords(
    allRecords.filter(
      (record) =>
        matchesFilter(record, filter) &&
        matchesSearch(record, normalizedQuery, language),
    ),
    sortKey,
    language,
  );
  const focusedRecord =
    allRecords.find((record) => record.recordKey === focusedKey) ??
    workspace?.draft ??
    null;
  const filterCounts = filterOptions.reduce(
    (counts, option) => ({
      ...counts,
      [option]: allRecords.filter((record) => matchesFilter(record, option))
        .length,
    }),
    {} as Record<WorkspaceFilter, number>,
  );

  useEffect(() => {
    if (!workspace) return;

    setDraftForm({
      nameAr: workspace.draft.nameAr,
      nameEn: workspace.draft.nameEn,
      barcode: workspace.draft.barcode,
      strength: workspace.draft.strength,
      packSize: workspace.draft.packSize,
      trackingMode: workspace.draft.trackingMode,
    });
    setDraftDirty(false);
  }, [workspace]);

  useEffect(() => {
    setPromotionReviewed(false);
    setIsPromotionReviewOpen(false);
  }, [workspace?.draft.updatedAt]);

  useEffect(() => {
    if (!workspace) return;

    const seeded: Partial<Record<MergeDiffPayload["field"], MergeDecisionValue>> =
      {};
    workspace.mergeDecision.diffs.forEach((diff) => {
      if (diff.decision) {
        seeded[diff.field] = diff.decision;
      }
    });
    setMergeDecisionDraft(seeded);
    setMergeRationale(workspace.mergeDecision.rationale ?? "");
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;

    const validKeys = new Set(
      [workspace.draft, ...workspace.references].map((record) => record.recordKey),
    );
    setSelectedKeys((current) => current.filter((key) => validKeys.has(key)));
    setFocusedKey((current) => (validKeys.has(current) ? current : "draft"));
  }, [workspace]);

  function getFlags(recordKey: string) {
    return (
      recordStates.get(recordKey) ?? {
        recordKey,
        queued: false,
        prioritized: false,
        reviewed: false,
        updatedAt: "",
      }
    );
  }

  async function apiFetch(path: string, init?: RequestInit) {
    if (!session) {
      throw new Error(
        language === "AR"
          ? "جلسة مساحة عمل المنتجات غير جاهزة بعد."
          : "Products workspace session is not ready.",
      );
    }

    const response = await fetch(`${session.apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        "x-tenant-id": session.tenantId,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | WorkspaceResponse
      | { draft: DraftPayload }
      | {
          message?: string;
          messageContract?: WorkspaceMessageContract;
          missingRequirements?: string[];
          conflictType?: string;
          operatorSummary?: string;
          blockedAction?: string;
          changedBy?: string | null;
          changedAt?: string | null;
          nextSteps?: string[];
          conflictingProduct?: {
            id: string;
            name: string;
            status: "ACTIVE" | "INACTIVE";
          };
        }
      | null;

    if (!response.ok) {
      const responseMessageContract =
        payload &&
        "messageContract" in payload &&
        payload.messageContract &&
        typeof payload.messageContract === "object"
          ? payload.messageContract
          : undefined;
      const baseMessage =
        payload && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : `Request failed (${response.status})`;
      const requirements =
        payload &&
        "missingRequirements" in payload &&
        Array.isArray(payload.missingRequirements)
          ? ` Missing: ${payload.missingRequirements.join(", ")}.`
          : "";
      const message =
        resolveServerLocalizedMessage(
          responseMessageContract?.staleConflictRejection ??
            (payload && "message" in payload ? payload.message : undefined),
          language,
          baseMessage,
        ) || `${baseMessage}${requirements}`;
      const conflictPayload =
        payload &&
        "conflictType" in payload &&
        typeof payload.conflictType === "string"
          ? ({
              message,
              conflictType: payload.conflictType,
              messageContract: responseMessageContract,
              operatorSummary:
                "operatorSummary" in payload &&
                typeof payload.operatorSummary === "string"
                  ? payload.operatorSummary
                  : undefined,
              blockedAction:
                "blockedAction" in payload &&
                typeof payload.blockedAction === "string"
                  ? payload.blockedAction
                  : undefined,
              changedBy:
                "changedBy" in payload &&
                (typeof payload.changedBy === "string" ||
                  payload.changedBy == null)
                  ? payload.changedBy
                  : null,
              changedAt:
                "changedAt" in payload &&
                (typeof payload.changedAt === "string" ||
                  payload.changedAt == null)
                  ? payload.changedAt
                  : null,
              nextSteps:
                "nextSteps" in payload && Array.isArray(payload.nextSteps)
                  ? payload.nextSteps.filter(
                      (step): step is string => typeof step === "string",
                    )
                  : [],
              conflictingProduct:
                "conflictingProduct" in payload &&
                payload.conflictingProduct &&
                typeof payload.conflictingProduct === "object"
                  ? payload.conflictingProduct
                  : undefined,
              recovery:
                "recovery" in payload &&
                payload.recovery &&
                typeof payload.recovery === "object" &&
                "retrySafe" in payload.recovery &&
                "refreshRequired" in payload.recovery &&
                "reopenRequired" in payload.recovery &&
                "rollbackMode" in payload.recovery &&
                "unchangedState" in payload.recovery &&
                "guidance" in payload.recovery
                  ? (payload.recovery as PromotionRecoveryPayload)
                  : undefined,
            } satisfies WorkspaceConflictPayload)
          : null;
      throw new WorkspaceApiError(message, conflictPayload);
    }

    return payload;
  }

  function buildDraftConcurrencyPayload() {
    if (!workspace) {
      throw new WorkspaceApiError(
        language === "AR"
          ? "جلسة مساحة عمل المنتجات غير جاهزة بعد."
          : "Products workspace session is not ready.",
        null,
      );
    }

    return toDraftConcurrencyPayload(workspace.draft);
  }

  async function refreshWorkspace(successMessage?: string) {
    if (!session) return;

    setBusyAction("refresh");
    setError(null);
    setConflict(null);

    try {
      const payload = (await apiFetch(
        "/products/workspace",
      )) as WorkspaceResponse;
      setWorkspace(payload);
      if (successMessage) {
        setNotice({ kind: "success", message: successMessage });
      }
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : language === "AR"
            ? "تعذر تحديث مساحة عمل المنتجات."
            : "Failed to refresh the products workspace.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function runWorkspaceAction(
    actionLabel: string,
    executor: () => Promise<void>,
  ) {
    setBusyAction(actionLabel);
    setError(null);
    setNotice(null);
    setConflict(null);

    try {
      await executor();
    } catch (actionError) {
      if (actionError instanceof WorkspaceApiError && actionError.conflict) {
        setConflict(actionError.conflict);
        setError(null);
      } else {
        setError(
          actionError instanceof Error
            ? actionError.message
            : language === "AR"
              ? "تعذر تنفيذ إجراء مساحة العمل."
              : "Products workspace action failed.",
        );
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function saveDraft() {
    await runWorkspaceAction("save-draft", async () => {
      await apiFetch("/products/workspace/draft", {
        method: "PATCH",
        body: JSON.stringify({
          ...draftForm,
          ...buildDraftConcurrencyPayload(),
        }),
      });
      await refreshWorkspace(
        language === "AR"
          ? "تم حفظ المسودة العاملة على الخادم."
          : "Current preparation saved.",
      );
    });
  }

  async function promoteDraft() {
    if (!promotionPlan?.canExecute) {
      setNotice({
        kind: "info",
        message:
          promotionPlan?.nextStep ??
          (language === "AR"
            ? "عالج عوائق الترقية قبل تأكيد النقل إلى الفهرس."
            : "Resolve the promotion blockers before confirming the move into catalog."),
      });
      return;
    }

    if (!promotionPlan.confirmedPlan) {
      setNotice({
        kind: "info",
        message:
          language === "AR"
            ? "خطة الترقية غير متاحة بعد. حدّث الصفحة ثم أعد المراجعة."
            : "Promotion plan is not available yet. Refresh and review again.",
      });
      return;
    }

    if (!promotionReviewed) {
      setNotice({
        kind: "info",
        message:
          language === "AR"
            ? "راجع لقطة الترقية قبل تأكيد التنفيذ."
            : "Review the promotion snapshot before confirming it.",
      });
      return;
    }

    await runWorkspaceAction("promote-draft", async () => {
      const payload = (await apiFetch("/products/workspace/draft/promote", {
        method: "POST",
        body: JSON.stringify({
          ...buildDraftConcurrencyPayload(),
          confirmed: true,
          plan: {
            mode: promotionPlan.confirmedPlan.mode,
            targetState: promotionPlan.confirmedPlan.targetState,
            items: promotionPlan.confirmedPlan.items.map((item) => ({
              fieldKey: item.fieldKey,
              source: item.source,
              value: item.value,
            })),
          },
        }),
      })) as WorkspaceResponse;
      setWorkspace(payload);
      setIsPromotionReviewOpen(false);
      setPromotionReviewed(false);
      setNotice({
        kind: "success",
        message:
          language === "AR"
            ? "تمت ترقية المسودة إلى الفهرس بحالة غير نشطة."
            : "Draft promoted to catalog (inactive).",
      });
    });
  }

  async function activateDraft() {
    await runWorkspaceAction("activate-draft", async () => {
      const payload = (await apiFetch("/products/workspace/draft/activate", {
        method: "POST",
        body: JSON.stringify(buildDraftConcurrencyPayload()),
      })) as WorkspaceResponse;
      setWorkspace(payload);
      setNotice({
        kind: "success",
        message:
          language === "AR"
            ? "تم تفعيل منتج الفهرس."
            : "Catalog product activated.",
      });
    });
  }

  async function deactivateDraft() {
    await runWorkspaceAction("deactivate-draft", async () => {
      const payload = (await apiFetch("/products/workspace/draft/deactivate", {
        method: "POST",
        body: JSON.stringify(buildDraftConcurrencyPayload()),
      })) as WorkspaceResponse;
      setWorkspace(payload);
      setNotice({
        kind: "success",
        message:
          language === "AR"
            ? "أُعيد منتج الفهرس إلى الحالة غير النشطة."
            : "Catalog product moved back to inactive.",
      });
    });
  }

  async function resetDraftToPlanning() {
    await runWorkspaceAction("reset-draft", async () => {
      const payload = (await apiFetch("/products/workspace/draft/reset", {
        method: "POST",
        body: JSON.stringify(buildDraftConcurrencyPayload()),
      })) as WorkspaceResponse;
      setWorkspace(payload);
      setNotice({
        kind: "info",
        message:
          language === "AR"
            ? "تمت إعادة المسودة العاملة إلى وضع التخطيط."
            : "Working draft returned to planning mode.",
      });
    });
  }

  async function saveMergeDecisions() {
    if (!workspace || !workspace.mergeDecision.hasDifferences) {
      setNotice({
        kind: "info",
        message:
          language === "AR"
            ? "لا توجد اختلافات مرجعية تحتاج قرارات دمج حالياً."
            : "No reference differences need merge decisions right now.",
      });
      return;
    }

    const decisions = workspace.mergeDecision.diffs
      .map((diff) => ({
        fieldKey: diff.field,
        decision: mergeDecisionDraft[diff.field],
      }))
      .filter(
        (
          item,
        ): item is { fieldKey: MergeDiffPayload["field"]; decision: MergeDecisionValue } =>
          item.decision === "APPLY_DRAFT" || item.decision === "KEEP_REFERENCE",
      );

    if (decisions.length === 0) {
      setNotice({
        kind: "info",
        message:
          language === "AR"
            ? "اختر قرار دمج واحداً على الأقل قبل الحفظ."
            : "Select at least one merge decision before saving.",
      });
      return;
    }

    await runWorkspaceAction("save-merge-decisions", async () => {
      const payload = (await apiFetch(
        "/products/workspace/draft/merge-decisions",
        {
          method: "POST",
          body: JSON.stringify({
            ...buildDraftConcurrencyPayload(),
            rationale: mergeRationale.trim() || undefined,
            decisions,
          }),
        },
      )) as WorkspaceResponse;
      setWorkspace(payload);
      setNotice({
        kind: "success",
        message:
          language === "AR"
            ? "تم حفظ قرارات الدمج مع توثيق تتبع مدعوم على مستوى المستأجر."
            : "Merge decisions saved with tenant-backed traceability.",
      });
    });
  }

  async function recordApprovalDecision(
    decision:
      | "SUBMIT_FOR_APPROVAL"
      | "APPROVED"
      | "REJECTED"
      | "REQUEST_CHANGES",
  ) {
    await runWorkspaceAction(
      `approval-${decision.toLowerCase()}`,
      async () => {
        const payload = (await apiFetch("/products/workspace/draft/approval", {
          method: "POST",
          body: JSON.stringify({
            ...buildDraftConcurrencyPayload(),
            decision,
            note: approvalNote.trim() || undefined,
          }),
        })) as WorkspaceResponse;
        setWorkspace(payload);
        setNotice({
          kind: "success",
          message:
            decision === "APPROVED"
              ? language === "AR"
                ? "تم تسجيل قرار الاعتماد."
                : "Approval recorded."
              : decision === "REJECTED"
                ? language === "AR"
                  ? "تم تسجيل قرار الرفض."
                  : "Rejection recorded."
                : decision === "REQUEST_CHANGES"
                  ? language === "AR"
                    ? "تم تسجيل طلب التعديلات."
                    : "Change request recorded."
                  : language === "AR"
                    ? "تم تسجيل الإرسال للاعتماد."
                    : "Submission for approval recorded.",
        });
      },
    );
  }

  async function packageHandoffSummary() {
    if (!workspace) return;

    await runWorkspaceAction("package-handoff", async () => {
      const payload = (await apiFetch("/products/workspace/draft/handoff", {
        method: "POST",
        body: JSON.stringify({
          ...buildDraftConcurrencyPayload(),
          expectedDecision: workspace.handoff.expectedDecision,
          note: handoffNote.trim() || undefined,
        }),
      })) as WorkspaceResponse;
      setWorkspace(payload);
      setNotice({
        kind: "success",
        message:
          language === "AR"
            ? "تم حفظ حزمة التسليم للدور التالي."
            : "Handoff package saved for the next role.",
      });
    });
  }

  async function applyFlagAction(
    action: "QUEUE" | "PRIORITIZE" | "MARK_REVIEWED" | "CLEAR",
    keysOverride?: string[],
  ) {
    const keys = keysOverride ?? selectedKeys;
    if (keys.length === 0) {
      setNotice({
        kind: "info",
        message:
          language === "AR"
            ? "حدد صفاً واحداً أو أكثر أولاً."
            : "Select one or more rows first.",
      });
      return;
    }

    await runWorkspaceAction(`flags-${action.toLowerCase()}`, async () => {
      const payload = (await apiFetch("/products/workspace/flags", {
        method: "POST",
        body: JSON.stringify({
          ...buildDraftConcurrencyPayload(),
          action,
          recordKeys: keys,
        }),
      })) as WorkspaceResponse;
      setWorkspace(payload);
      setNotice({
        kind: "success",
        message:
          action === "QUEUE"
            ? language === "AR"
              ? "تمت إضافة المجموعة المحددة إلى قائمة الانتظار على الخادم."
              : "Selected records added to the queue."
            : action === "PRIORITIZE"
              ? language === "AR"
                ? "تم تعليم المجموعة المحددة كأولوية على الخادم."
                : "Selected records marked as priority."
              : action === "MARK_REVIEWED"
                ? language === "AR"
                  ? "تم تعليم المجموعة المحددة كمراجَعة."
                  : "Selected set marked reviewed."
                : language === "AR"
                  ? "تم مسح علامات سير العمل المحددة."
                  : "Selected workflow flags cleared.",
      });
    });
  }

  async function saveWorklist() {
    if (worklistName.trim().length === 0) {
      setNotice({
        kind: "info",
        message:
          language === "AR"
            ? "أدخل اسماً مختصراً لقائمة العمل أولاً."
            : "Give the worklist a short name first.",
      });
      return;
    }

    await runWorkspaceAction("save-worklist", async () => {
      const payload = (await apiFetch("/products/workspace/worklists", {
        method: "POST",
        body: JSON.stringify({
          ...buildDraftConcurrencyPayload(),
          name: worklistName.trim(),
          query,
          filter,
          selectedKeys,
          focusedKey,
          scopeSummary:
            selectedKeys.length === 0
              ? language === "AR"
                ? "تم حفظ سياق البحث والتصفية."
                : "Saved search and filter context."
              : language === "AR"
                ? `تم حفظ ${selectedKeys.length} سجلاً محدداً مع سياق البحث والتصفية الحالي.`
                : `${selectedKeys.length} selected record(s) with current search and filter context.`,
        }),
      })) as WorkspaceResponse;
      setWorkspace(payload);
      setWorklistName("");
      setNotice({
        kind: "success",
        message:
          language === "AR"
            ? "تم حفظ قائمة العمل على الخادم."
            : "Worklist saved.",
      });
      openInspector("worklists");
    });
  }

  async function deleteWorklist(worklistId: string) {
    await runWorkspaceAction("delete-worklist", async () => {
      const payload = (await apiFetch(
        `/products/workspace/worklists/${worklistId}`,
        {
          method: "DELETE",
        },
      )) as WorkspaceResponse;
      setWorkspace(payload);
      setNotice({
        kind: "success",
        message:
          language === "AR" ? "تم حذف قائمة العمل." : "Worklist deleted.",
      });
    });
  }

  function loadWorklist(worklist: WorklistPayload) {
    const validKeys = new Set(allRecords.map((record) => record.recordKey));
    const nextSelectedKeys = worklist.selectedKeys.filter((key) =>
      validKeys.has(key),
    );

    setQuery(worklist.query);
    setFilter(worklist.filter);
    setSelectedKeys(nextSelectedKeys);
    setFocusedKey(validKeys.has(worklist.focusedKey) ? worklist.focusedKey : "draft");
    openInspector("worklists");
    setNotice({
      kind: "info",
      message:
        language === "AR"
          ? `تم تحميل قائمة العمل "${worklist.name}".`
          : `Loaded worklist "${worklist.name}".`,
    });
  }

  function focusBarcodeCapture() {
    setIsDraftOpen(true);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  }

  function openInspector(tab?: InspectorTab) {
    if (tab) {
      setInspectorTab(tab);
    }
    setIsInspectorOpen(true);
  }

  function toggleSelection(recordKey: string, checked: boolean) {
    setSelectedKeys((current) =>
      checked
        ? Array.from(new Set([...current, recordKey]))
        : current.filter((key) => key !== recordKey),
    );
  }

  const draft = workspace?.draft ?? null;
  const normalizedDraftBarcode = draftForm.barcode.trim().toLowerCase();
  const allowedBarcodeOwnerId = draft?.catalogProductId ?? draft?.basedOnProductId;
  const localDuplicateReference =
    draft && normalizedDraftBarcode
      ? workspace?.references.find(
          (reference) =>
            reference.barcode.trim().toLowerCase() === normalizedDraftBarcode &&
            reference.id !== allowedBarcodeOwnerId,
        ) ?? null
      : null;
  const barcodeConflict =
    draft?.duplicateBarcodeConflict ??
    (localDuplicateReference
      ? {
          barcode: localDuplicateReference.barcode,
          conflictingProductId: localDuplicateReference.id,
          conflictingProductName:
            (language === "AR"
              ? localDuplicateReference.nameAr || localDuplicateReference.nameEn
              : localDuplicateReference.nameEn || localDuplicateReference.nameAr) ||
            (language === "AR" ? "منتج موجود" : "Existing product"),
          conflictingProductStatus:
            localDuplicateReference.status === "PROMOTED_ACTIVE"
              ? ("ACTIVE" as const)
              : ("INACTIVE" as const),
          conflictingProductUpdatedAt: localDuplicateReference.updatedAt,
        }
      : null);
  const promotionPlan = getPromotionExecutionPlan(
    workspace,
    draftDirty,
    barcodeConflict,
    language,
  );
  const promotionConfirmation = getPromotionConfirmation(workspace, language);
  const promotionRecovery = getPromotionRecoverySummary(conflict, language);
  const locale = getUiLocale(language);
  const isRtl = language === "AR";
  const ui = uiCopy[language];
  const helpContent = isRtl ? helpContentAr : helpContentEn;
  const workspaceMessageContract = workspace?.messageContract;
  const hasServerMessageContract = hasProductsMessageContract(
    workspaceMessageContract,
  );
  const activationReadyContract = resolveContractMessage(
    workspaceMessageContract,
    "activationReady",
    language,
    ui.activationReadyText,
  );
  const activationBlockedContract = resolveContractMessage(
    workspaceMessageContract,
    "activationBlocked",
    language,
    ui.activationBlockedText,
  );
  const alreadyActiveContract = resolveContractMessage(
    workspaceMessageContract,
    "alreadyActive",
    language,
    ui.activeNowText,
  );
  const activationCurrentContract = resolveActivationContractMessage(
    workspaceMessageContract,
    "currentState",
    language,
    ui.activationPendingText,
  );
  const activationPendingContract = resolveActivationContractMessage(
    workspaceMessageContract,
    "pendingState",
    language,
    ui.nextActionDraft,
  );
  const activationChangedContract = resolveActivationContractMessage(
    workspaceMessageContract,
    "changedState",
    language,
    "لا يوجد تغيير مؤكد بعد.",
  );
  const activationNextStepContract = resolveActivationContractMessage(
    workspaceMessageContract,
    "nextStep",
    language,
    "راجع جاهزية المسودة ثم أكمل الخطوة التالية.",
  );
  const activationContinuity =
    workspace && draft
      ? {
          activeNow:
            activationCurrentContract ??
            (draft.status === "PROMOTED_ACTIVE"
              ? alreadyActiveContract ?? ui.activeNowText
              : draft.status === "PROMOTED_INACTIVE"
                ? ui.activationPendingText
                : ui.activationNotStarted),
          pending:
            activationPendingContract ??
            (draft.status === "PROMOTED_ACTIVE"
              ? ui.nextActionActive
              : draft.status === "PROMOTED_INACTIVE"
                ? draft.readiness.canActivate
                  ? activationReadyContract ?? ui.activationReadyText
                  : activationBlockedContract ?? ui.activationBlockedText
                : ui.nextActionDraft),
          changed:
            promotionConfirmation?.stateChangeLabel ??
            activationChangedContract ??
            promotionPlan?.changedStateLabel ??
            (language === "AR"
              ? "لا يوجد تغيير مؤكد بعد."
              : "No confirmed promotion change yet."),
          nextStep:
            activationNextStepContract ??
            (draft.status === "PROMOTED_ACTIVE"
              ? ui.nextActionActive
              : draft.status === "PROMOTED_INACTIVE"
                ? draft.readiness.canActivate
                  ? activationReadyContract ?? ui.activateCatalogPrompt
                  : localizeServerText(
                      draft.readiness.nextStep,
                      language,
                      "لا يمكن التفعيل حالياً حتى يكتمل شرط الجاهزية.",
                    )
                : promotionPlan?.nextStep ??
                  localizeServerText(
                    draft.readiness.nextStep,
                    language,
                    "راجع جاهزية المسودة ثم أكمل الخطوة التالية.",
                  )),
          badge:
            draft.status === "PROMOTED_ACTIVE"
              ? ui.activeLabel
              : draft.status === "PROMOTED_INACTIVE"
                ? draft.readiness.canActivate
                  ? ui.readyLabel
                  : ui.blockedLabel
                : ui.pendingLabel,
          summary: ui.confirmationActionLabel,
        }
      : null;
  const rowPadding = density === "COMPACT" ? "py-2" : "py-3";

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-5 text-slate-100 md:px-6"
      dir={isRtl ? "rtl" : "ltr"}
      lang={locale}
    >
      <div className="mx-auto flex max-w-[1500px] min-w-0 flex-col gap-5">
        <section className="rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] p-5 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                  {ui.productsWorkspace}
                </span>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                  {ui.serverBackedTruth}
                </span>
                {hasServerMessageContract ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-200">
                    {language === "AR"
                      ? "عقد الرسائل من الخادم"
                      : "Saved guidance"}
                  </span>
                ) : null}
                {workspace ? (
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                    {ui.synced} {formatRelativeTime(workspace.syncedAt, locale)}
                  </span>
                ) : null}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white md:text-3xl">
                  {helpContent.pageName}
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  {helpContent.purpose}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/80 p-1">
                <span className="px-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  {ui.languageName}
                </span>
                <button
                  aria-pressed={language === "EN"}
                  className={`rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition ${
                    language === "EN"
                      ? "bg-sky-500/20 text-sky-100"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                  onClick={() => setLanguage("EN")}
                  type="button"
                >
                  EN
                </button>
                <button
                  aria-pressed={language === "AR"}
                  className={`rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition ${
                    language === "AR"
                      ? "bg-sky-500/20 text-sky-100"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                  onClick={() => setLanguage("AR")}
                  type="button"
                >
                  AR
                </button>
              </div>
              <button
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                onClick={() => setIsDraftOpen((current) => !current)}
                type="button"
              >
                {isDraftOpen ? ui.hideWorkingDraft : ui.openWorkingDraft}
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                onClick={() => setIsHelpOpen((current) => !current)}
                type="button"
              >
                {isHelpOpen ? ui.hideHelp : ui.openHelp}
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                onClick={() => setIsInspectorOpen((current) => !current)}
                type="button"
              >
                {isInspectorOpen ? ui.closeSupportPanel : ui.openSupportPanel}
              </button>
              <button
                className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-400"
                onClick={focusBarcodeCapture}
                type="button"
              >
                {ui.startBarcodeCapture}
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                disabled={busyAction === "refresh" || session == null}
                onClick={() =>
                  void refreshWorkspace(ui.refreshWorkspace)
                }
                type="button"
              >
                {ui.refreshTruth}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {ui.startHere}
              </p>
              <ol className="mt-3 space-y-2 text-sm text-slate-200">
                {helpContent.startHere.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-300">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {ui.workingDraftTruth}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-sm ${draft ? getStatusTone(draft.status) : "border-slate-700 bg-slate-900 text-slate-300"}`}
                >
                  {draft
                    ? getStatusLabel(draft.status, language)
                    : language === "AR"
                      ? "جارٍ التحميل"
                      : "Loading"}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-300">
                  {workspace?.truthMode === "SERVER_BACKED"
                    ? language === "AR"
                      ? "محفوظة لهذا الفرع"
                      : "Saved for this branch"
                    : language === "AR"
                      ? "تجهيز الجلسة"
                      : "Preparing session"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {draft
                  ? localizeOperationalText(
                      draft.readiness.operatorSummary,
                      language,
                      "ستظهر حالة المسودة العاملة عندما تصبح الجلسة جاهزة.",
                    )
                  : language === "AR"
                    ? "ستظهر حالة المسودة العاملة عندما تصبح الجلسة جاهزة."
                    : "Working draft status will appear once the session is ready."}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {ui.barcodeFlow}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                <p>{ui.scanFirst}</p>
                <p>{ui.scanWedge}</p>
                <p>{ui.manualFallback}</p>
              </div>
            </div>
          </div>

          {notice ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                notice.kind === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-sky-500/40 bg-sky-500/10 text-sky-100"
              }`}
            >
              {localizeOperationalText(
                notice.message,
                language,
                "تم تحديث حالة مساحة عمل المنتجات.",
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {conflict ? (
            <div className="mt-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-200">
                {language === "AR" ? "إجراء محجوب" : "Action blocked"}
              </p>
              <p className="mt-1.5 font-medium text-amber-100">
                {resolveContractMessage(
                  conflict.messageContract,
                  "staleConflictRejection",
                  language,
                  "تم حجب الإجراء بسبب تغيّر الحالة قبل اكتمال العملية.",
                ) ||
                  localizeServerText(
                    conflict.message,
                    language,
                    "تم حجب الإجراء بسبب تغيّر حالة المسودة أو المرجع.",
                  )}
              </p>
              {conflict.operatorSummary ? (
                <p className="mt-1.5 text-amber-50">
                  {resolveConflictContractSummary(conflict, language) ||
                    localizeServerText(
                      conflict.operatorSummary,
                      language,
                      "راجع سبب الحجب قبل إعادة المحاولة.",
                    )}
                </p>
              ) : null}
              <div className="mt-2 space-y-1 text-amber-50/90">
                {conflict.blockedAction ? (
                  <p>
                    {language === "AR" ? "الإجراء المحجوب:" : "Blocked action:"}{" "}
                    {localizeOperationalText(
                      conflict.blockedAction,
                      language,
                      "إجراء محجوب مؤقتاً حتى مراجعة الحالة الحالية.",
                    )}
                  </p>
                ) : null}
                {conflict.changedBy ? (
                  <p>
                    {language === "AR" ? "تم التغيير بواسطة:" : "Changed by:"}{" "}
                    {conflict.changedBy}
                  </p>
                ) : null}
                {conflict.changedAt ? (
                  <p>
                    {language === "AR" ? "وقت التغيير:" : "Changed at:"}{" "}
                    {formatRelativeTime(conflict.changedAt, locale)}
                  </p>
                ) : null}
              </div>
              {conflict.nextSteps && conflict.nextSteps.length > 0 ? (
                <ul className="mt-3 space-y-2 text-amber-50">
                  {conflict.nextSteps.map((step) => (
                    <li key={step}>
                      -{" "}
                      {localizeOperationalText(
                        step,
                        language,
                        "راجع العائق الحالي ثم أعد المحاولة بعد حله.",
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {promotionRecovery ? (
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <div className="rounded-xl border border-amber-500/30 bg-slate-950/60 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
                      {ui.whatStayedUnchanged}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-amber-50">
                      {promotionRecovery.unchanged}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-slate-950/60 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
                      {ui.retrySafety}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-amber-50">
                      {promotionRecovery.retrySafety}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-slate-950/60 px-3 py-2 lg:col-span-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
                      {ui.refreshOrReopen}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-amber-50">
                      {promotionRecovery.refreshOrReopen}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-amber-50">
                      {ui.nextStep}: {promotionRecovery.nextStep}
                    </p>
                    <p className="mt-1.5 text-xs uppercase tracking-[0.18em] text-amber-200">
                      {ui.rollbackModel}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-xl border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-50 transition hover:border-amber-300"
                  onClick={() =>
                    void refreshWorkspace(
                      language === "AR"
                        ? "تم تحديث مساحة العمل إلى أحدث حقيقة على الخادم."
                        : "Preparation desk refreshed with the latest saved changes.",
                    )
                  }
                  type="button"
                >
                  {language === "AR" ? "حدّث الآن" : "Refresh now"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {isDraftOpen && draft ? (
          <section className="rounded-[26px] border border-slate-800 bg-slate-900/90 p-5 shadow-xl shadow-slate-950/30">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                    {ui.workingDraft}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] ${getStatusTone(draft.status)}`}
                  >
                    {getStatusLabel(draft.status, language)}
                  </span>
                  {draftDirty ? (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-200">
                      {ui.unsavedChanges}
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-300">
                      {language === "AR" ? "محفوظ" : "Saved"}{" "}
                      <bdi dir="ltr">
                        {formatRelativeTime(draft.updatedAt, locale)}
                      </bdi>
                    </span>
                  )}
                </div>
                <p className="text-sm leading-6 text-slate-300">
                  {localizeOperationalText(
                    draft.readiness.operatorSummary,
                    language,
                    "راجع جاهزية المسودة ثم نفّذ الإجراء التالي.",
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {draft.readiness.missingForCatalog.length > 0 ? (
                    draft.readiness.missingForCatalog.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                      >
                        {localizeDraftRequirement(item, language)}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                      {ui.noMissingRequirements}
                    </span>
                  )}
                </div>
                {barcodeConflict ? (
                  <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-200">
                      {ui.duplicateBarcodeDetected}
                    </p>
                    <p className="mt-2">
                      {language === "AR" ? "الباركود" : "Barcode"}{" "}
                      <bdi dir="ltr">{barcodeConflict.barcode}</bdi>{" "}
                      {language === "AR" ? "مرتبط بالفعل بـ" : "already belongs to"}{" "}
                      <span className="font-medium">
                        {barcodeConflict.conflictingProductName}
                      </span>{" "}
                      (
                      <bdi dir="ltr">
                        {localizeLifecycleState(
                          barcodeConflict.conflictingProductStatus.toLowerCase(),
                          language,
                        )}
                      </bdi>
                      ).
                    </p>
                    <p className="mt-1">
                      {language === "AR"
                        ? "امسح باركوداً مختلفاً، أو استخدم المنتج الموجود كمرجع بدلاً من إنشاء نسخة مكررة."
                        : "Scan a different barcode, or use the existing product as your reference instead of creating a duplicate."}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
                <button
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !draft.readiness.canEdit ||
                    !draftDirty ||
                    barcodeConflict != null ||
                    busyAction != null
                  }
                  onClick={() => void saveDraft()}
                  type="button"
                >
                  {ui.saveWorkingDraft}
                </button>
                <button
                  className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busyAction != null}
                  onClick={() =>
                    setIsPromotionReviewOpen((current) => !current)
                  }
                  type="button"
                >
                  {isPromotionReviewOpen
                    ? ui.hidePromotionControls
                    : ui.reviewPromotion}
                </button>
                <button
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!draft.readiness.canActivate || busyAction != null}
                  onClick={() => void activateDraft()}
                  type="button"
                >
                  {ui.activate}
                </button>
                <button
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!draft.readiness.canDeactivate || busyAction != null}
                  onClick={() => void deactivateDraft()}
                  type="button"
                >
                  {ui.deactivate}
                </button>
                <button
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busyAction != null}
                  onClick={() => void resetDraftToPlanning()}
                  type="button"
                >
                  {ui.returnToPlanningMode}
                </button>
              </div>
            </div>

            {promotionConfirmation ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">
                      {ui.promotionConfirmation}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      {ui.promotionRecordedReviewable}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-emerald-50">
                      {language === "AR"
                        ? "يبقى هذا السجل داخل مساحة العمل بعد التحديث حتى يتمكن المشغل من التحقق مما تم ترقيته وما الخطوة التالية."
                        : "This receipt stays in the workspace after refresh so the operator can verify what was promoted and what to do next."}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-100">
                    {promotionConfirmation.currentStateLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-500/20 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {ui.whatWasPromoted}
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {promotionConfirmation.productLabel}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {promotionConfirmation.stateChangeLabel}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {language === "AR" ? "تمت الترقية في" : "Promoted at"}{" "}
                      <bdi dir="ltr">
                        {formatExactDateTime(promotionConfirmation.promotedAt, locale)}
                      </bdi>
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {ui.referenceAndFinalState}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {language === "AR" ? "المرجع المصدر:" : "Source reference:"}{" "}
                      <span dir="auto">{promotionConfirmation.referenceLabel}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {language === "AR" ? "الحالة النهائية:" : "Final state:"}{" "}
                      <span dir="auto">{promotionConfirmation.finalStateLabel}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {ui.nextStep}: {promotionConfirmation.nextStep}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {activationContinuity ? (
              <div className="mt-4 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-sky-200">
                      {ui.activationContinuity}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      {ui.confirmationActionLabel}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-sky-50">
                      {ui.activationReadinessSummary}
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-100">
                    {activationContinuity.badge}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-sky-500/20 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {ui.currentState}
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {activationContinuity.activeNow}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {activationContinuity.pending}
                    </p>
                  </div>

                  <div className="rounded-xl border border-sky-500/20 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {ui.changedState}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {activationContinuity.changed}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {ui.activationNextStep}: {activationContinuity.nextStep}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {isPromotionReviewOpen ? (
              <div className="mt-4 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-sky-200">
                      {ui.promotionExecutionControls}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      {ui.reviewExactSnapshot}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-sky-50">
                      {ui.promotionAcknowledgement}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-200">
                    {promotionPlan?.canExecute
                      ? language === "AR"
                        ? "جاهز للتأكيد"
                        : "Ready to confirm"
                      : ui.blockedLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-sky-500/20 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {ui.whatWillBePromoted}
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {promotionPlan?.snapshotLabel ??
                        (language === "AR"
                          ? "لقطة المسودة العاملة"
                          : "Working draft snapshot")}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {language === "AR" ? "مصدر المرجع:" : "Reference source:"}{" "}
                      <span dir="auto">
                        {promotionPlan?.referenceLabel ??
                          (language === "AR"
                            ? "لا يوجد مرجع مرتبط"
                            : "No linked reference")}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {language === "AR" ? "الحالة النهائية:" : "Final state:"}{" "}
                      {promotionPlan?.promotedStateLabel ??
                        (language === "AR"
                          ? "مسجل في الفهرس وغير نشط"
                          : "Catalog listed and inactive")}
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-200">
                      {(promotionPlan?.confirmedPlan?.items ?? []).map((item) => (
                        <p key={item.fieldKey}>
                          {localizeMergeFieldLabel(item.fieldKey, language, item.label)}:{" "}
                          {item.value ||
                            (language === "AR"
                              ? "لم يتم تسجيله بعد"
                              : "Not captured yet")}{" "}
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            (
                            {item.source === "REFERENCE"
                              ? language === "AR"
                                ? "مرجع"
                                : "reference"
                              : language === "AR"
                                ? "مسودة"
                                : "draft"}
                            )
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-500/20 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {ui.stateChange}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {promotionPlan?.changedStateLabel ??
                        (language === "AR"
                          ? "ستصبح المسودة العاملة منتجاً في الفهرس وستبقى غير نشطة حتى التفعيل."
                          : "The working draft will become a catalog product and remain inactive until activation.")}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {ui.nextStep}:{" "}
                      {promotionPlan?.nextStep ??
                        (language === "AR"
                          ? "راجع اللقطة أولاً."
                          : "Review the snapshot first.")}
                    </p>
                  </div>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-xl border border-sky-500/20 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                  <input
                    checked={promotionReviewed}
                    className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
                    disabled={!promotionPlan?.canExecute || busyAction != null}
                    onChange={(event) => setPromotionReviewed(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="leading-6">
                    {language === "AR"
                      ? "راجعت هذه اللقطة وأفهم أن الترقية ستنشئ أو تحدّث منتج الفهرس بوضع غير نشط."
                      : "I reviewed this snapshot and understand that promotion will create or refresh the catalog product as inactive."}
                  </span>
                </label>

                {promotionPlan?.blockers && promotionPlan.blockers.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-200">
                      {ui.promotionBlocked}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {promotionPlan.blockers.map((blocker) => (
                        <li key={blocker}>
                          -{" "}
                          {localizeOperationalText(
                            blocker,
                            language,
                            "عالج هذا العائق قبل إعادة محاولة الترقية.",
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      busyAction != null ||
                      !promotionPlan?.canExecute ||
                      !promotionReviewed
                    }
                    onClick={() => void promoteDraft()}
                    type="button"
                  >
                    {ui.confirmPromotionIntoCatalog}
                  </button>
                  <button
                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null}
                    onClick={() => {
                      setIsPromotionReviewOpen(false);
                      setPromotionReviewed(false);
                    }}
                    type="button"
                  >
                    {ui.cancel}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  key: "nameAr" as const,
                  label: language === "AR" ? "الاسم (عربي)" : "Name (AR)",
                  placeholder: "مثال: ديمو سيفيكسيم ٤٠٠ كبسولات",
                  dir: "auto" as const,
                },
                {
                  key: "nameEn" as const,
                  label: language === "AR" ? "الاسم (إنجليزي)" : "Name (EN)",
                  placeholder: "Example: Demo Cefixime 400 Capsules",
                  dir: "auto" as const,
                },
                {
                  key: "strength" as const,
                  label: language === "AR" ? "التركيز" : "Strength",
                  placeholder: "400mg",
                  dir: "ltr" as const,
                },
                {
                  key: "packSize" as const,
                  label: language === "AR" ? "العبوة" : "Pack",
                  placeholder: language === "AR" ? "10 كبسولات" : "10 capsules",
                  dir: "auto" as const,
                },
                {
                  key: "barcode" as const,
                  label: language === "AR" ? "الباركود" : "Barcode",
                  placeholder:
                    language === "AR"
                      ? "ابدأ بالمسح. اكتب يدوياً فقط عند التعذّر."
                      : "Scan first. Type only as fallback.",
                  dir: "ltr" as const,
                },
              ].map((field) => (
                <label key={field.key} className="block text-sm text-slate-300">
                  <span>{field.label}</span>
                  <input
                    ref={field.key === "barcode" ? barcodeInputRef : undefined}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    dir={field.dir}
                    disabled={!draft.readiness.canEdit || busyAction != null}
                    onChange={(event) => {
                      setDraftForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }));
                      setDraftDirty(true);
                      setConflict(null);
                    }}
                    placeholder={field.placeholder}
                    value={draftForm[field.key]}
                  />
                </label>
              ))}

              <label className="block text-sm text-slate-300">
                <span>{language === "AR" ? "التتبع" : "Tracking"}</span>
                <select
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!draft.readiness.canEdit || busyAction != null}
                  onChange={(event) => {
                    setDraftForm((current) => ({
                      ...current,
                      trackingMode: event.target.value as TrackingMode,
                    }));
                    setDraftDirty(true);
                    setConflict(null);
                  }}
                  value={draftForm.trackingMode}
                >
                  {(
                    Object.keys(trackingModeLabelsByLanguage[language]) as Array<TrackingMode>
                  ).map((option) => (
                    <option key={option} value={option}>
                      {getLocalizedLabel(language, trackingModeLabelsByLanguage, option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {language === "AR"
                    ? "قرارات الدمج مع المرجع"
                    : "Reference merge decisions"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {workspace?.mergeDecision.operatorSummary
                    ? resolveContractMessage(
                        workspaceMessageContract,
                        "mergeSummary",
                        language,
                        "ستظهر قرارات الدمج عندما تختلف المسودة عن المرجع المرتبط.",
                      ) ||
                      localizeServerText(
                        workspace.mergeDecision.operatorSummary,
                        language,
                        "ستظهر قرارات الدمج عندما تختلف المسودة عن المرجع المرتبط.",
                      )
                    : language === "AR"
                      ? "ستظهر قرارات الدمج عندما تختلف المسودة عن المرجع المرتبط."
                      : "Merge decisions will appear when draft differs from a linked reference."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                    {language === "AR" ? "معلّق" : "Pending"}{" "}
                    {workspace?.mergeDecision.pendingCount ?? 0}
                  </span>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                    {language === "AR" ? "اعتماد المسودة" : "Apply draft"}{" "}
                    {workspace?.mergeDecision.applyDraftCount ?? 0}
                  </span>
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                    {language === "AR" ? "الإبقاء على المرجع" : "Keep reference"}{" "}
                    {workspace?.mergeDecision.keepReferenceCount ?? 0}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {(workspace?.mergeDecision.diffs ?? []).length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-400">
                      {language === "AR" ? "لا توجد حقول مختلفة." : "No differing fields."}
                    </div>
                  ) : (
                    workspace?.mergeDecision.diffs.map((diff) => (
                      <div
                        key={diff.field}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {localizeMergeFieldLabel(
                                diff.field,
                                language,
                                diff.label,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {language === "AR" ? "المرجع:" : "Reference:"}{" "}
                              {diff.referenceValue}
                            </p>
                            <p className="text-xs text-slate-400">
                              {language === "AR" ? "المسودة:" : "Draft:"} {diff.draftValue}
                            </p>
                          </div>
                          <select
                            className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white"
                            onChange={(event) =>
                              setMergeDecisionDraft((current) => ({
                                ...current,
                                [diff.field]: event.target
                                  .value as MergeDecisionValue,
                              }))
                            }
                            value={
                              mergeDecisionDraft[diff.field] ??
                              diff.decision ??
                              ""
                            }
                          >
                            <option value="">
                              {language === "AR" ? "اختر القرار" : "Select"}
                            </option>
                            <option value="APPLY_DRAFT">
                              {language === "AR" ? "اعتماد المسودة" : "Apply draft"}
                            </option>
                            <option value="KEEP_REFERENCE">
                              {language === "AR" ? "الإبقاء على المرجع" : "Keep reference"}
                            </option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <textarea
                  className="mt-3 min-h-[72px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  onChange={(event) => setMergeRationale(event.target.value)}
                  placeholder={
                    language === "AR"
                      ? "سبب القرار لحزمة الدمج (اختياري)"
                      : "Optional rationale for this merge package"
                  }
                  value={mergeRationale}
                />
                <p className="mt-2 text-xs text-slate-400">
                  {language === "AR" ? "الخطوة التالية:" : "Next:"}{" "}
                  {workspace?.mergeDecision.nextStep
                    ? localizeServerText(
                        workspace.mergeDecision.nextStep,
                        language,
                        "انتظر تحديث حالة مساحة العمل.",
                      )
                    : language === "AR"
                      ? "انتظر تحديث حالة مساحة العمل."
                      : "Awaiting workspace state."}
                </p>
                <button
                  className="mt-3 w-full rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    busyAction != null || !(workspace?.mergeDecision.hasDifferences ?? false)
                  }
                  onClick={() => void saveMergeDecisions()}
                  type="button"
                >
                  {language === "AR" ? "حفظ قرارات الدمج" : "Save merge decisions"}
                </button>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {language === "AR" ? "توثيق الاعتماد" : "Approval traceability"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${getApprovalTone(
                      workspace?.approval.status ?? "PENDING_REVIEW",
                    )}`}
                  >
                    {getApprovalLabel(
                      workspace?.approval.status ?? "PENDING_REVIEW",
                      language,
                    )}
                  </span>
                  {workspace?.approval.lastDecision ? (
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                      {language === "AR" ? "آخر قرار" : "Last decision"}{" "}
                      <bdi dir="ltr">
                        {formatRelativeTime(
                          workspace.approval.lastDecision.decidedAt,
                          locale,
                        )}
                      </bdi>
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {workspace?.approval.operatorSummary
                    ? resolveContractMessage(
                        workspaceMessageContract,
                        "approvalSummary",
                        language,
                        "ستظهر حالة الاعتماد بعد تحميل مساحة العمل.",
                      ) ||
                      localizeServerText(
                        workspace.approval.operatorSummary,
                        language,
                        "ستظهر حالة الاعتماد بعد تحميل مساحة العمل.",
                      )
                    : language === "AR"
                      ? "ستظهر حالة الاعتماد بعد تحميل مساحة العمل."
                      : "Approval state will appear once workspace is loaded."}
                </p>
                {workspace?.approval.lastDecision ? (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                    <p>
                      {localizeApprovalDecisionLabel(
                        workspace.approval.lastDecision.decisionLabel,
                        language,
                      )}
                    </p>
                    <p className="mt-1">
                      {language === "AR" ? "بواسطة" : "By"}{" "}
                      {workspace.approval.lastDecision.decidedBy ??
                        (language === "AR" ? "غير معروف" : "Unknown")}
                    </p>
                    {workspace.approval.lastDecision.note ? (
                      <p className="mt-1">{workspace.approval.lastDecision.note}</p>
                    ) : null}
                  </div>
                ) : null}
                <textarea
                  className="mt-3 min-h-[72px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  onChange={(event) => setApprovalNote(event.target.value)}
                  placeholder={
                    language === "AR"
                      ? "ملاحظة اعتماد (اختيارية)"
                      : "Optional approval note"
                  }
                  value={approvalNote}
                />
                <p className="mt-2 text-xs text-slate-400">
                  {language === "AR" ? "الخطوة التالية:" : "Next:"}{" "}
                  {workspace?.approval.nextStep
                    ? localizeServerText(
                        workspace.approval.nextStep,
                        language,
                        "انتظر تحديث حالة مساحة العمل.",
                      )
                    : language === "AR"
                      ? "انتظر تحديث حالة مساحة العمل."
                      : "Awaiting workspace state."}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null || !(workspace?.approval.required ?? false)}
                    onClick={() => void recordApprovalDecision("SUBMIT_FOR_APPROVAL")}
                    type="button"
                  >
                    {language === "AR" ? "إرسال" : "Submit"}
                  </button>
                  <button
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null || !(workspace?.approval.required ?? false)}
                    onClick={() => void recordApprovalDecision("APPROVED")}
                    type="button"
                  >
                    {language === "AR" ? "اعتماد" : "Approve"}
                  </button>
                  <button
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null || !(workspace?.approval.required ?? false)}
                    onClick={() => void recordApprovalDecision("REQUEST_CHANGES")}
                    type="button"
                  >
                    {language === "AR" ? "طلب تعديلات" : "Request changes"}
                  </button>
                  <button
                    className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null || !(workspace?.approval.required ?? false)}
                    onClick={() => void recordApprovalDecision("REJECTED")}
                    type="button"
                  >
                    {language === "AR" ? "رفض" : "Reject"}
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {language === "AR" ? "حزمة التسليم" : "Handoff package"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {workspace?.handoff.summary
                    ? resolveContractMessage(
                        workspaceMessageContract,
                        "handoffSummary",
                        language,
                        "احفظ حزمة التسليم ليتمكن الدور التالي من المتابعة دون الرجوع لسجلات خام.",
                      ) ||
                      localizeServerText(
                        workspace.handoff.summary,
                        language,
                        "احفظ حزمة التسليم ليتمكن الدور التالي من المتابعة دون الرجوع لسجلات خام.",
                      )
                    : language === "AR"
                      ? "احفظ حزمة التسليم ليتمكن الدور التالي من المتابعة دون الرجوع لسجلات خام."
                      : "Create a handoff package so the next role can act without reading raw logs."}
                </p>
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <p>
                    {language === "AR" ? "القرار المتوقع:" : "Expected decision:"}{" "}
                    <span className="text-slate-100">
                      {getExpectedDecisionLabel(
                        workspace?.handoff.expectedDecision ?? "NONE",
                        language,
                      )}
                    </span>
                  </p>
                  <p>
                    {language === "AR" ? "الجاهزية:" : "Ready:"}{" "}
                    <span className="text-slate-100">
                      {workspace?.handoff.ready
                        ? language === "AR"
                          ? "نعم"
                          : "Yes"
                        : language === "AR"
                          ? "لا"
                          : "No"}
                    </span>
                  </p>
                  {workspace?.handoff.packagedAt ? (
                    <p>
                      {language === "AR" ? "آخر حزمة" : "Last package"}{" "}
                      <bdi dir="ltr">
                        {formatRelativeTime(workspace.handoff.packagedAt, locale)}
                      </bdi>
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {language === "AR" ? "تم إنجازه" : "Changed"}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {(workspace?.handoff.changed ?? []).slice(0, 5).map((item) => (
                        <li key={item}>
                          -{" "}
                          {localizeOperationalText(
                            item,
                            language,
                            "تم توثيق تغيير داخل حزمة التسليم.",
                          )}
                        </li>
                      ))}
                      {(workspace?.handoff.changed ?? []).length === 0 ? (
                        <li>{language === "AR" ? "لا يوجد" : "None"}</li>
                      ) : null}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {language === "AR" ? "المعلّق / العوائق" : "Pending / blockers"}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {[...(workspace?.handoff.pending ?? []), ...(workspace?.handoff.blockers ?? [])]
                        .slice(0, 6)
                        .map((item) => (
                          <li key={item}>
                            -{" "}
                            {localizeOperationalText(
                              item,
                              language,
                              "عنصر معلّق أو عائق ضمن حزمة التسليم.",
                            )}
                          </li>
                        ))}
                      {(workspace?.handoff.pending ?? []).length === 0 &&
                      (workspace?.handoff.blockers ?? []).length === 0 ? (
                        <li>{language === "AR" ? "لا يوجد" : "None"}</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
                <textarea
                  className="mt-3 min-h-[72px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  onChange={(event) => setHandoffNote(event.target.value)}
                  placeholder={
                    language === "AR"
                      ? "ملاحظة تسليم (اختيارية)"
                      : "Optional handoff note"
                  }
                  value={handoffNote}
                />
                <p className="mt-2 text-xs text-slate-400">
                  {language === "AR" ? "الخطوة التالية:" : "Next:"}{" "}
                  {workspace?.handoff.nextStep
                    ? localizeServerText(
                        workspace.handoff.nextStep,
                        language,
                        "انتظر تحديث حالة مساحة العمل.",
                      )
                    : language === "AR"
                      ? "انتظر تحديث حالة مساحة العمل."
                      : "Awaiting workspace state."}
                </p>
                <button
                  className="mt-3 w-full rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busyAction != null}
                  onClick={() => void packageHandoffSummary()}
                  type="button"
                >
                  {language === "AR" ? "حفظ حزمة التسليم" : "Package handoff"}
                </button>
              </section>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              {language === "AR"
                ? "ابدأ بالمسح. إذا كان قارئ الباركود يعمل كلوحة مفاتيح، أبقِ المؤشر داخل حقل الباركود ثم امسح. استخدم الإدخال اليدوي فقط عند تعذّر المسح."
                : "Scan first. If your hardware scanner behaves as keyboard input, keep the cursor in the barcode field and scan there. Type the barcode only when scanning is unavailable."}
            </div>
          </section>
        ) : null}

        <div
          className={`grid gap-5 ${isInspectorOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]" : ""}`}
        >
          <section className="min-w-0 rounded-[26px] border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-slate-950/30">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
                <label className="block text-sm text-slate-300">
                  <span>{language === "AR" ? "بحث" : "Search"}</span>
                  <input
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    dir="auto"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      language === "AR"
                        ? "ابحث باسم المنتج أو الباركود أو التركيز أو العبوة"
                        : "Search by product name, barcode, strength, or pack"
                    }
                    value={query}
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  <span>{language === "AR" ? "ترتيب" : "Sort"}</span>
                  <select
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    onChange={(event) => setSortKey(event.target.value as SortKey)}
                    value={sortKey}
                  >
                    <option value="READINESS">
                      {language === "AR" ? "الجاهزية" : "Readiness"}
                    </option>
                    <option value="NAME">{language === "AR" ? "الاسم" : "Name"}</option>
                    <option value="SOURCE">
                      {language === "AR" ? "المصدر" : "Source"}
                    </option>
                  </select>
                </label>

                <label className="block text-sm text-slate-300">
                  <span>{language === "AR" ? "الكثافة" : "Density"}</span>
                  <select
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    onChange={(event) =>
                      setDensity(event.target.value as DensityMode)
                    }
                    value={density}
                  >
                    <option value="COMFORTABLE">
                      {language === "AR" ? "مريحة" : "Comfortable"}
                    </option>
                    <option value="COMPACT">
                      {language === "AR" ? "مضغوطة" : "Compact"}
                    </option>
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                {language === "AR"
                  ? `${visibleRecords.length} ظاهر · ${selectedKeys.length} محدد · ${workspace?.worklists.length ?? 0} قائمة عمل محفوظة`
                  : `${visibleRecords.length} visible · ${selectedKeys.length} selected · ${workspace?.worklists.length ?? 0} saved worklists`}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option}
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    filter === option
                      ? "border-sky-500/50 bg-sky-500/10 text-sky-100"
                      : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                  }`}
                  onClick={() => setFilter(option)}
                  type="button"
                >
                  {filterLabels[language][option]} · {filterCounts[option] ?? 0}
                </button>
              ))}
            </div>

            <div className="mt-3 text-sm text-slate-400">
              {filterDescriptions[language][filter]}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedKeys.length === 0 || busyAction != null}
                onClick={() => void applyFlagAction("QUEUE")}
                type="button"
              >
                {language === "AR" ? "إضافة المحدد إلى الانتظار" : "Queue selected set"}
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedKeys.length === 0 || busyAction != null}
                onClick={() => void applyFlagAction("PRIORITIZE")}
                type="button"
              >
                {language === "AR"
                  ? "تعليم المحدد كأولوية"
                  : "Prioritize selected set"}
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedKeys.length === 0 || busyAction != null}
                onClick={() => void applyFlagAction("MARK_REVIEWED")}
                type="button"
              >
                {language === "AR"
                  ? "تعليم المحدد كمراجَع"
                  : "Mark selected set reviewed"}
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedKeys.length === 0 || busyAction != null}
                onClick={() => void applyFlagAction("CLEAR")}
                type="button"
              >
                {language === "AR" ? "مسح علامات المحدد" : "Clear selected flags"}
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                onClick={() => openInspector("worklists")}
                type="button"
              >
                {language === "AR" ? "قوائم العمل" : "Worklists"}
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-800">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead
                    className={`bg-slate-950/90 text-xs uppercase tracking-[0.24em] text-slate-400 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <tr>
                      <th className="px-4 py-3">{language === "AR" ? "تحديد" : "Pick"}</th>
                      <th className="px-4 py-3">{language === "AR" ? "المنتج" : "Product"}</th>
                      <th className="px-4 py-3">
                        {language === "AR" ? "الباركود" : "Barcode"}
                      </th>
                      <th className="px-4 py-3">{language === "AR" ? "المصدر" : "Source"}</th>
                      <th className="px-4 py-3">
                        {language === "AR" ? "دورة الحالة" : "Lifecycle"}
                      </th>
                      <th className="px-4 py-3">
                        {language === "AR" ? "الخطوة التالية" : "Next step"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((record) => {
                      const selected = selectedKeys.includes(record.recordKey);
                      const focused = focusedKey === record.recordKey;
                      const flags = getFlags(record.recordKey);

                      return (
                        <tr
                          key={record.recordKey}
                          className={`border-t border-slate-800 transition ${
                            focused
                              ? "bg-sky-500/5"
                              : selected
                                ? "bg-slate-900/80"
                                : "bg-slate-950/30"
                          }`}
                        >
                          <td className={`px-4 ${rowPadding}`}>
                            <input
                              checked={selected}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500"
                              onChange={(event) =>
                                toggleSelection(record.recordKey, event.target.checked)
                              }
                              type="checkbox"
                            />
                          </td>
                          <td className={`px-4 ${rowPadding}`}>
                            <button
                              className={`w-full ${isRtl ? "text-right" : "text-left"}`}
                              onClick={() => {
                                setFocusedKey(record.recordKey);
                                openInspector("record");
                              }}
                              type="button"
                            >
                              <div className="font-medium text-white">
                                {getDisplayName(record, language)}
                              </div>
                              <div className="mt-1 text-sm text-slate-400">
                                {language === "AR"
                                  ? record.nameEn ||
                                    (record.source === "draft"
                                      ? "لا يوجد اسم إنجليزي بعد"
                                      : "")
                                  : record.nameAr ||
                                    (record.source === "draft"
                                      ? "No Arabic name yet"
                                      : "")}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {flags.queued ? (
                                  <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200">
                                    {language === "AR" ? "بالانتظار" : "Queued"}
                                  </span>
                                ) : null}
                                {flags.prioritized ? (
                                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                                    {language === "AR" ? "أولوية" : "Priority"}
                                  </span>
                                ) : null}
                                {flags.reviewed ? (
                                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">
                                    {language === "AR" ? "مراجَع" : "Reviewed"}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          </td>
                          <td className={`px-4 ${rowPadding}`}>
                            <div className="font-mono text-sm text-slate-200" dir="ltr">
                              <bdi>
                                {record.barcode ||
                                  (language === "AR"
                                    ? "لا يوجد باركود بعد"
                                    : "No barcode yet")}
                              </bdi>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              <bdi dir="ltr">
                                {record.strength ||
                                  (language === "AR" ? "بدون تركيز" : "No strength")}
                              </bdi>{" "}
                              ·{" "}
                              <span dir="auto">
                                {record.packSize ||
                                  (language === "AR" ? "بدون عبوة" : "No pack")}
                              </span>
                            </div>
                          </td>
                          <td className={`px-4 ${rowPadding}`}>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs ${getSourceTone(record.source)}`}
                            >
                              {sourceLabelsByLanguage[language][record.source]}
                            </span>
                          </td>
                          <td className={`px-4 ${rowPadding}`}>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs ${getStatusTone(record.status)}`}
                            >
                              {getStatusLabel(record.status, language)}
                            </span>
                          </td>
                          <td className={`px-4 ${rowPadding}`}>
                            <div className="max-w-[300px] text-sm leading-6 text-slate-300">
                              {getRecordNextStep(record, language)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {isInspectorOpen ? (
            <aside className="min-w-0 rounded-[26px] border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-slate-950/30">
              <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-2">
              {[
                ["record", language === "AR" ? "السجل" : "Record"],
                ["worklists", language === "AR" ? "قوائم العمل" : "Worklists"],
                ["history", language === "AR" ? "سجل الإجراءات" : "Action log"],
                ["help", language === "AR" ? "المساعدة" : "Help"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    inspectorTab === key
                      ? "bg-sky-500/10 text-sky-100"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                  onClick={() => openInspector(key as InspectorTab)}
                  type="button"
                >
                  {label}
                </button>
              ))}
              </div>
              <button
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                onClick={() => setIsInspectorOpen(false)}
                type="button"
              >
                {language === "AR" ? "إغلاق لوحة الدعم" : "Close support panel"}
              </button>

            {inspectorTab === "record" && focusedRecord ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${getSourceTone(focusedRecord.source)}`}
                    >
                      {sourceLabelsByLanguage[language][focusedRecord.source]}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${getStatusTone(focusedRecord.status)}`}
                    >
                      {getStatusLabel(focusedRecord.status, language)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-white">
                    {getDisplayName(focusedRecord, language)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {focusedRecord.source === "draft"
                      ? localizeServerText(
                          focusedRecord.readiness.operatorSummary,
                          language,
                          "راجع جاهزية المسودة ثم نفّذ الإجراء التالي.",
                        )
                      : language === "AR"
                        ? "تبقى المنتجات المرجعية للقراءة فقط هنا. استخدم المسودة العاملة لإجراء التغييرات."
                        : "Reference products stay read-only here. Use the working draft for changes."}
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  {[
                    [
                      language === "AR" ? "الباركود" : "Barcode",
                      focusedRecord.barcode ||
                        (language === "AR"
                          ? "لا يوجد باركود بعد"
                          : "No barcode yet"),
                    ],
                    [
                      language === "AR" ? "التركيز" : "Strength",
                      focusedRecord.strength ||
                        (language === "AR"
                          ? "لا يوجد تركيز بعد"
                          : "No strength yet"),
                    ],
                    [
                      language === "AR" ? "العبوة" : "Pack",
                      focusedRecord.packSize ||
                        (language === "AR"
                          ? "لا توجد عبوة بعد"
                          : "No pack yet"),
                    ],
                    [
                      language === "AR" ? "التتبع" : "Tracking",
                      getLocalizedLabel(
                        language,
                        trackingModeLabelsByLanguage,
                        focusedRecord.trackingMode,
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4">
                      <span className="text-sm text-slate-400">{label}</span>
                      <span className={`${isRtl ? "text-left" : "text-right"} text-sm text-slate-100`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {language === "AR" ? "الخطوة التالية" : "Next step"}
                  </p>
                  <p className="mt-2">
                    {getRecordNextStep(focusedRecord, language)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null}
                    onClick={() => {
                      setSelectedKeys([focusedRecord.recordKey]);
                      void applyFlagAction("QUEUE", [focusedRecord.recordKey]);
                    }}
                    type="button"
                  >
                    {language === "AR" ? "إضافة المحدد للانتظار" : "Queue focused"}
                  </button>
                  <button
                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null}
                    onClick={() => {
                      setSelectedKeys([focusedRecord.recordKey]);
                      void applyFlagAction("PRIORITIZE", [focusedRecord.recordKey]);
                    }}
                    type="button"
                  >
                    {language === "AR" ? "تعليم المحدد كأولوية" : "Prioritize focused"}
                  </button>
                  <button
                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null}
                    onClick={() => {
                      setSelectedKeys([focusedRecord.recordKey]);
                      void applyFlagAction("MARK_REVIEWED", [focusedRecord.recordKey]);
                    }}
                    type="button"
                  >
                    {language === "AR" ? "تعليم المحدد كمراجَع" : "Mark focused reviewed"}
                  </button>
                </div>
              </div>
            ) : null}

            {inspectorTab === "record" && !focusedRecord ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-5 text-sm leading-6 text-slate-300">
                <p className="font-medium text-white">
                  {language === "AR" ? "لا يوجد سجل محدد بعد." : "No record selected yet."}
                </p>
                <p className="mt-2">
                  {language === "AR"
                    ? "اختر صف منتج لمراجعة التفاصيل والعلامات وإرشاد الخطوة التالية."
                    : "Pick a product row to inspect details, flags, and next-step guidance."}
                </p>
              </div>
            ) : null}

            {inspectorTab === "worklists" ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {language === "AR" ? "حفظ السياق الحالي" : "Save current context"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {language === "AR"
                      ? "احفظ البحث والتصفية والصفوف المحددة والتركيز على الخادم لهذا المستأجر."
                      : "Save search, filter, selected rows, and focus to the server for this tenant."}
                  </p>
                  <input
                    className="mt-3 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    onChange={(event) => setWorklistName(event.target.value)}
                    placeholder={language === "AR" ? "اسم قائمة العمل" : "Worklist name"}
                    value={worklistName}
                  />
                  <button
                    className="mt-3 w-full rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction != null}
                    onClick={() => void saveWorklist()}
                    type="button"
                  >
                    {language === "AR" ? "حفظ قائمة العمل" : "Save worklist"}
                  </button>
                </div>

                <div className="space-y-3">
                  {(workspace?.worklists ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-5 text-sm text-slate-300">
                      {language === "AR" ? "لا توجد قوائم عمل محفوظة بعد." : "No saved worklists yet."}
                    </div>
                  ) : (
                    workspace?.worklists.map((worklist) => (
                      <div
                        key={worklist.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                      >
                        <div>
                          <h3 className="font-medium text-white">{worklist.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            {localizeServerText(
                              worklist.scopeSummary,
                              language,
                              "سياق مراجعة محفوظ ومدعوم من الخادم.",
                            ) ||
                              (language === "AR"
                                ? "سياق مراجعة محفوظ للفرع الحالي."
                                : "Saved review context for the active branch.")}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            {filterLabels[language][worklist.filter]} ·{" "}
                            {language === "AR" ? "تم التحديث" : "Updated"}{" "}
                            <bdi dir="ltr">
                              {formatRelativeTime(worklist.updatedAt, locale)}
                            </bdi>
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                            onClick={() => loadWorklist(worklist)}
                            type="button"
                          >
                            {language === "AR" ? "تحميل" : "Load"}
                          </button>
                          <button
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 transition hover:border-rose-400"
                            onClick={() => void deleteWorklist(worklist.id)}
                            type="button"
                          >
                            {language === "AR" ? "حذف" : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {inspectorTab === "history" ? (
              <div className="mt-4 space-y-3">
                {(workspace?.history ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-5 text-sm text-slate-300">
                    {language === "AR"
                      ? "لا توجد إدخالات في سجل الإجراءات المشتركة بعد."
                      : "No shared action log entries yet."}
                  </div>
                ) : (
                  workspace?.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium text-white">
                          {localizeOperationalText(
                            entry.label,
                            language,
                            "إجراء ضمن مساحة عمل المنتجات.",
                          )}
                        </h3>
                        <span className="text-xs text-slate-500">
                          {formatRelativeTime(entry.createdAt, locale)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {localizeOperationalText(
                          entry.scopeSummary,
                          language,
                          "ملخص تشغيلي محفوظ لهذا الإجراء.",
                        )}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {localizeHistoryOrigin(entry.origin, language)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {inspectorTab === "help" ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <h2 className="text-lg font-semibold text-white">
                    {helpContent.pageName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {helpContent.purpose}
                  </p>
                </div>

                {helpContent.sections.map((section) => (
                  <div
                    key={section.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <h3 className="font-medium text-white">{section.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{section.summary}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                      {section.details.map((detail) => (
                        <li key={detail}>- {detail}</li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <h3 className="font-medium text-white">
                    {language === "AR" ? "ملاحظات الحقيقة" : "Truth notes"}
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {(workspace?.truthNotes ?? helpContent.truthNotes).map((note) => (
                      <li key={note}>- {localizeTruthNote(note, language)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            </aside>
          ) : null}
        </div>

        {isHelpOpen ? (
          <section className="rounded-[26px] border border-slate-800 bg-slate-900/90 p-5 shadow-xl shadow-slate-950/30">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {language === "AR" ? "مساعدة سياقية" : "Contextual help"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {language === "AR"
                    ? "تبقى هذه اللوحة مساعدة ثانوية. استخدمها لتوضيح الجاهزية والتعامل مع الباركود ومعنى السجلات المرجعية للقراءة فقط من دون تشتيت عن جدول المنتجات."
                    : "Support stays secondary here. Use it to clarify readiness, barcode handling, and the meaning of read-only references without taking focus away from the product table."}
                </p>
              </div>
              <button
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                onClick={() => setIsHelpOpen(false)}
                type="button"
              >
                {language === "AR" ? "إغلاق المساعدة" : "Close help"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {language === "AR" ? "المصطلحات" : "Glossary"}
                </p>
                <div className="mt-3 space-y-3">
                  {helpContent.glossary.map((item) => (
                    <div key={item.term}>
                      <p className="font-medium text-white">{item.term}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {item.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {language === "AR" ? "الحقائق والقيود" : "Truth and limits"}
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                  {(workspace?.truthNotes ?? helpContent.truthNotes).map((note) => (
                    <li key={note}>- {localizeTruthNote(note, language)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          {language === "AR"
            ? "تبقى تفضيلات العرض على هذا الجهاز مثل الكثافة والترتيب، بينما حالة الصنف وقوائم العمل والعلامات وسجل الإجراءات تبقى مشتركة للفرع الحالي."
            : "Display preferences such as density and sort stay on this device, while product status, worklists, flags, and the action log stay shared for the active branch."}
        </section>
      </div>
    </main>
  );
}

