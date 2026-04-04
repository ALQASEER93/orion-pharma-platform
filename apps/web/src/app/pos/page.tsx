"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getApiBase } from "../../lib/api-base";

type PosContextResponse = {
  tenantId: string;
  contextSource: "DEMO_SEED_OR_REAL_DB" | "REAL_DB_RUNTIME";
  branches: Array<{ id: string; name: string; legalEntityId: string | null }>;
  registers: Array<{
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    branchId: string;
    legalEntityId: string | null;
  }>;
  defaultBranchId: string | null;
  defaultRegisterId: string | null;
};

type CatalogPack = {
  packId: string;
  packCode: string;
  packBarcode?: string | null;
  packStatus?: string | null;
  packSellability?: string | null;
  unitsPerPack?: number | null;
  product: {
    id: string;
    nameEn: string;
    nameAr: string;
    tradeNameEn?: string | null;
    tradeNameAr?: string | null;
    genericNameEn?: string | null;
    genericNameAr?: string | null;
    categoryEn?: string | null;
    categoryAr?: string | null;
    barcode?: string | null;
    strength?: string | null;
    packSize?: string | null;
    defaultSalePrice?: number | null;
    taxProfileCode?: string | null;
    isActive?: boolean;
    dosageForm?: {
      id: string;
      nameEn: string;
      nameAr: string;
    } | null;
    supplier?: {
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
    } | null;
  };
  lots: Array<{
    lotBatchId: string;
    batchNo: string;
    expiryDate?: string | null;
    status?: string | null;
    isSellable?: boolean;
    onHandQuantity?: number;
    sellableQuantity: number;
    quarantinedQuantity?: number;
    expiredQuantity?: number;
  }>;
};

type PosCartSession = {
  id: string;
  sessionNumber: string;
  state: "OPEN" | "PAYMENT_PENDING" | "FINALIZED" | "CANCELLED";
  branchId: string;
  registerId: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  fiscalSaleDocumentId: string | null;
  fiscalSaleDocument?: {
    documentNo: string;
    state: string;
    grandTotal: number;
    finalizedAt?: string | null;
  } | null;
  paymentFinalizations?: Array<{
    paymentMethod: string;
    finalizedAt?: string | null;
    referenceCode?: string | null;
  }>;
  lines: Array<{
    id: string;
    lineNo: number;
    productPackId: string;
    lotBatchId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number | null;
    productPack?: {
      code: string;
      packBarcode?: string | null;
      packStatus?: string | null;
      packSellability?: string | null;
      unitsPerPack?: number | null;
      product: {
        nameEn: string;
        nameAr: string;
        barcode?: string | null;
      };
    };
    lotBatch?: {
      batchNo: string;
      expiryDate?: string | null;
      status?: string | null;
      sellableQuantity?: number;
    } | null;
  }>;
};

type FinalizedSaleSummary = {
  id: string;
  documentNo: string;
  state: string;
  grandTotal: number;
  currency: string;
  finalizedAt?: string | null;
  posCartSession?: { sessionNumber: string } | null;
  paymentFinalizations?: Array<{
    paymentMethod: string;
    finalizedAt?: string | null;
    referenceCode?: string | null;
  }>;
};

type FinalizedSaleDetail = {
  id: string;
  documentNo: string;
  state: string;
  branchId: string;
  registerId: string | null;
  grandTotal: number;
  currency: string;
  finalizedAt?: string | null;
  posCartSession?: { sessionNumber: string } | null;
  paymentFinalizations?: Array<{
    paymentMethod: string;
    finalizedAt?: string | null;
    referenceCode?: string | null;
  }>;
  lines: Array<{
    id: string;
    lineNo: number;
    productPackId: string;
    lotBatchId: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number | null;
    alreadyReturnedQty: number;
    remainingQty: number;
    productPack: { product: { nameEn: string; nameAr: string } };
    lotBatch: { batchNo: string } | null;
  }>;
};

type PosReturnSession = {
  id: string;
  returnNumber: string;
  state: "OPEN" | "FINALIZED" | "CANCELLED";
  fiscalReturnDocumentId: string | null;
  fiscalReturnDocument?: { documentNo: string } | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
};

type FinalizedReturnSummary = {
  returnReference: string;
  returnSessionNumber: string;
  sourceSaleReference: string;
  sourceSessionReference: string | null;
  amount: number;
  currency: string;
  finalizedAt: string;
};

type OpenCartSession = {
  id: string;
  sessionNumber: string;
  state: string;
  grandTotal: number;
};

type LineEditState = {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};
type FocusedProductSnapshot = {
  title: string;
  subtitle: string;
  batch: string;
  expiryLabel: string;
  barcode: string;
  packCode: string;
  sellability: string;
  stockLabel: string;
  runtimeHonesty: string;
};
type StatusTone = "emerald" | "amber" | "rose" | "slate" | "sky";
type OperatorActionState =
  | "setup"
  | "load-workspace"
  | "start-sale"
  | "resume-sale"
  | "return-mode";
type CatalogSearchMode = "trade" | "generic" | "supplier" | "category";
type PosWorkspaceView = "cashier" | "search" | "maintenance" | "returns";
type SupplierOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
};
type MaintenanceFormState = {
  productId: string;
  tradeNameEn: string;
  tradeNameAr: string;
  genericNameEn: string;
  genericNameAr: string;
  categoryEn: string;
  categoryAr: string;
  strength: string;
  dosageFormName: string;
  packSize: string;
  barcode: string;
  supplierId: string;
  defaultSalePrice: string;
  taxProfileCode: string;
  packCode: string;
  packBarcode: string;
  batchNo: string;
  expiryDate: string;
  branchStockQuantity: string;
  isActive: boolean;
};

const defaultTenant = "11111111-1111-4111-8111-111111111111";
const defaultBranch = "22222222-2222-4222-8222-222222222222";
const surfaceClass =
  "rounded-[14px] border border-slate-800 bg-[#151b22]";
const mutedSurfaceClass =
  "rounded-[10px] border border-slate-800 bg-[#161d25]";
const inputClass =
  "h-10 w-full rounded-[8px] border border-slate-700 bg-[#10151c] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-[#0d1117] disabled:text-slate-500";

const primaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[8px] border border-emerald-500/60 bg-emerald-600 px-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-800 disabled:text-slate-500";
const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[8px] border border-slate-700 bg-[#171d26] px-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-slate-500 hover:bg-[#1d2430] disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-[#11161c] disabled:text-slate-500";
const accentButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[8px] border border-amber-500/60 bg-amber-500 px-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-800 disabled:text-slate-500";
const metricCardClass =
  "rounded-[8px] border border-slate-700 bg-[#11161d] px-3 py-2.5";
const searchCategoryExamples = [
  "Tablets",
  "Syrup",
  "Suppositories",
  "Supplements",
  "Cosmetics",
];
const maintenanceCategories = [
  "Medicine",
  "Supplement",
  "Cosmetic",
  "Syrup",
  "Tablets",
  "Suppositories",
  "Medical device",
];
const dosageFormExamples = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suppository",
  "Cream",
  "Device",
];
const searchModeMeta: Record<
  CatalogSearchMode,
  { label: string; placeholder: string; note: string }
> = {
  trade: {
    label: "Trade name",
    placeholder: "Search by trade/commercial name or barcode",
    note: "Lookup is backed by persisted product truth plus the current branch runtime anchor.",
  },
  generic: {
    label: "Generic / active ingredient",
    placeholder: "Search by generic name or active ingredient",
    note: "Generic search uses persisted generic fields from the product truth and keeps the same sellable runtime anchor visible when it exists.",
  },
  supplier: {
    label: "Supplier / company",
    placeholder: "Search by supplier or company",
    note: "Supplier/company search now uses the current supplier model only where supplier truth actually exists.",
  },
  category: {
    label: "Category / form",
    placeholder: "Search by category or dosage form",
    note: "Category and dosage-form search now use persisted classification fields instead of placeholder affordances.",
  },
};

const emptyMaintenanceForm = (): MaintenanceFormState => ({
  productId: "",
  tradeNameEn: "",
  tradeNameAr: "",
  genericNameEn: "",
  genericNameAr: "",
  categoryEn: "Medicine",
  categoryAr: "",
  strength: "",
  dosageFormName: "Tablet",
  packSize: "",
  barcode: "",
  supplierId: "",
  defaultSalePrice: "0.00",
  taxProfileCode: "READINESS_STANDARD",
  packCode: "",
  packBarcode: "",
  batchNo: "",
  expiryDate: "",
  branchStockQuantity: "0",
  isActive: true,
});

function buildMaintenanceFormFromSelection(
  selection: { pack: CatalogPack; lot: CatalogPack["lots"][number] } | null,
): MaintenanceFormState {
  if (!selection) {
    return emptyMaintenanceForm();
  }

  const product = selection.pack.product;
  return {
    productId: product.id,
    tradeNameEn: product.tradeNameEn ?? product.nameEn,
    tradeNameAr: product.tradeNameAr ?? product.nameAr,
    genericNameEn: product.genericNameEn ?? "",
    genericNameAr: product.genericNameAr ?? "",
    categoryEn: product.categoryEn ?? "Medicine",
    categoryAr: product.categoryAr ?? "",
    strength: product.strength ?? "",
    dosageFormName: product.dosageForm?.nameEn ?? "Tablet",
    packSize: product.packSize ?? "",
    barcode: product.barcode ?? "",
    supplierId: product.supplier?.id ?? "",
    defaultSalePrice: `${product.defaultSalePrice ?? 0}`,
    taxProfileCode: product.taxProfileCode ?? "READINESS_STANDARD",
    packCode: selection.pack.packCode,
    packBarcode: selection.pack.packBarcode ?? product.barcode ?? "",
    batchNo: selection.lot.batchNo,
    expiryDate: selection.lot.expiryDate?.slice(0, 10) ?? "",
    branchStockQuantity: `${selection.lot.sellableQuantity}`,
    isActive: product.isActive ?? true,
  };
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function parseApiError(payload: unknown, status: number) {
  if (!payload || typeof payload !== "object")
    return `Request failed (${status}).`;
  const data = payload as { message?: unknown; error?: unknown };
  if (typeof data.message === "string") return data.message;
  if (Array.isArray(data.message)) return data.message.join(" | ");
  if (data.message && typeof data.message === "object") {
    const nested = data.message as { message?: string; details?: unknown };
    if (nested.message && Array.isArray(nested.details)) {
      return `${nested.message}: ${nested.details.map((x) => JSON.stringify(x)).join(" | ")}`;
    }
    if (nested.message) return nested.message;
  }
  if (typeof data.error === "string") return data.error;
  return `Request failed (${status}).`;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-JO", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Not exposed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-JO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function stateTone(state?: string | null): StatusTone {
  switch (state) {
    case "FINALIZED":
    case "ACCEPTED":
      return "emerald";
    case "OPEN":
    case "PAYMENT_PENDING":
      return "sky";
    case "CANCELLED":
    case "REJECTED":
      return "rose";
    default:
      return "slate";
  }
}

function ToneBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: StatusTone;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : tone === "amber"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
        : tone === "rose"
          ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
          : tone === "sky"
            ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
            : "border-slate-600 bg-[#232a34] text-slate-300";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em]",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}


function CompactInfoCard({
  label,
  value,
  supporting,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  supporting?: ReactNode;
  tone?: StatusTone;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10"
      : tone === "amber"
        ? "border-amber-400/30 bg-amber-500/10"
        : tone === "rose"
          ? "border-rose-400/30 bg-rose-500/10"
          : tone === "sky"
            ? "border-sky-400/30 bg-sky-500/10"
            : "border-slate-600 bg-[#181e27]";

  return (
    <div className={cn("rounded-[8px] border px-3 py-2.5", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-slate-100">{value}</p>
      {supporting ? (
        <p className="mt-1 text-xs leading-5 text-slate-400">{supporting}</p>
      ) : null}
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  tone?: StatusTone;
}) {
  const toneClass =
    tone === "emerald"
      ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : tone === "amber"
        ? "border border-amber-400/30 bg-amber-500/10 text-amber-100"
        : tone === "rose"
          ? "border border-rose-400/30 bg-rose-500/10 text-rose-100"
          : tone === "sky"
            ? "border border-sky-400/30 bg-sky-500/10 text-sky-100"
            : "border border-slate-600 bg-[#181e27] text-slate-200";

  return (
    <div className={cn("rounded-[8px] px-3 py-2 text-sm", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Notice({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "success" | "error" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : tone === "error"
        ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
        : "border-sky-400/30 bg-sky-500/10 text-sky-100";

  return (
    <div className={cn("rounded-[8px] border px-3.5 py-3", toneClass)}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{body}</p>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-slate-700 bg-[#11161d] px-5 py-8 text-center text-sm text-slate-400">
      <p className="text-base font-semibold text-slate-200">{title}</p>
      <p className="mt-2 leading-6">{body}</p>
    </div>
  );
}

function InvoiceHeaderCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500",
        align === "right" && "text-right",
      )}
    >
      {children}
    </div>
  );
}

function SearchModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[8px] border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition",
        active
          ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
          : "border-slate-700 bg-[#11161d] text-slate-300 hover:border-slate-500 hover:text-slate-100",
      )}
    >
      {label}
    </button>
  );
}

export default function PosPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [branchId, setBranchId] = useState(defaultBranch);
  const [registerId, setRegisterId] = useState("");
  const [legalEntityId, setLegalEntityId] = useState("");
  const [email, setEmail] = useState("admin@orion.local");
  const [password, setPassword] = useState("Admin@123");
  const [token, setToken] = useState("");

  const [context, setContext] = useState<PosContextResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogPack[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSearchMode, setCatalogSearchMode] =
    useState<CatalogSearchMode>("trade");
  const [maintenanceForm, setMaintenanceForm] =
    useState<MaintenanceFormState>(emptyMaintenanceForm);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState<string | null>(null);
  const [openCarts, setOpenCarts] = useState<OpenCartSession[]>([]);

  const [cartSession, setCartSession] = useState<PosCartSession | null>(null);
  const [lineEdits, setLineEdits] = useState<Record<string, LineEditState>>({});
  const [focusedInvoiceLineId, setFocusedInvoiceLineId] = useState("");
  const [selectedCatalogKey, setSelectedCatalogKey] = useState("");
  const [newLineQty, setNewLineQty] = useState(1);
  const [newLinePrice, setNewLinePrice] = useState(0);
  const [cashTendered, setCashTendered] = useState("");

  const [salesSearch, setSalesSearch] = useState("");
  const [finalizedSales, setFinalizedSales] = useState<FinalizedSaleSummary[]>(
    [],
  );
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedSaleDetail, setSelectedSaleDetail] =
    useState<FinalizedSaleDetail | null>(null);
  const [returnSession, setReturnSession] = useState<PosReturnSession | null>(
    null,
  );
  const [returnSourceLineId, setReturnSourceLineId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnUnitPrice, setReturnUnitPrice] = useState(0);
  const [, setReturnFinalizedAt] = useState<string | null>(null);
  const [finalizedReturnSummary, setFinalizedReturnSummary] =
    useState<FinalizedReturnSummary | null>(null);
  const [secondaryPane, setSecondaryPane] = useState<"lookup" | "return">(
    "lookup",
  );
  const [workspaceView, setWorkspaceView] =
    useState<PosWorkspaceView>("cashier");

  const [contextError, setContextError] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isCartMutable =
    !!cartSession &&
    (cartSession.state === "OPEN" || cartSession.state === "PAYMENT_PENDING");
  const safeOpenCarts = useMemo(
    () => (Array.isArray(openCarts) ? openCarts : []),
    [openCarts],
  );
  const safeCartLines = useMemo(
    () => (Array.isArray(cartSession?.lines) ? cartSession.lines : []),
    [cartSession?.lines],
  );
  const safeSelectedSaleLines = useMemo(
    () =>
      Array.isArray(selectedSaleDetail?.lines) ? selectedSaleDetail.lines : [],
    [selectedSaleDetail?.lines],
  );
  const activeBranch =
    context?.branches.find((item) => item.id === branchId) ?? null;
  const activeRegister =
    context?.registers.find((item) => item.id === registerId) ?? null;
  const isReturnMutable = !!returnSession && returnSession.state === "OPEN";

  const selectedSalePayment =
    selectedSaleDetail?.paymentFinalizations?.[0] ?? null;
  const selectedReturnSourceLine =
    safeSelectedSaleLines.find((line) => line.id === returnSourceLineId) ??
    null;
  const workspaceReady = Boolean(token && context && registerId);
  const operatorAuthenticated = Boolean(token);

  const returnFinalized = returnSession?.state === "FINALIZED";
  const returnFocusMode = Boolean(
    selectedSaleDetail || returnSession || finalizedReturnSummary,
  );


  const operatorActionState: OperatorActionState = !operatorAuthenticated
    ? "setup"
    : !workspaceReady
      ? "load-workspace"
      : cartSession && isCartMutable
        ? "resume-sale"
        : returnFocusMode
          ? "return-mode"
          : "start-sale";

  const visibleCatalogOptions = useMemo(() => {
    const packs = Array.isArray(catalog) ? catalog : [];
    const search = catalogSearch.trim().toLowerCase();
    return packs.flatMap((pack) =>
      (Array.isArray(pack.lots) ? pack.lots : [])
        .filter((lot) => {
          if (!search) return true;
          return [
            pack.product.nameEn,
            pack.product.nameAr,
            pack.product.tradeNameEn ?? "",
            pack.product.tradeNameAr ?? "",
            pack.product.genericNameEn ?? "",
            pack.product.genericNameAr ?? "",
            pack.product.categoryEn ?? "",
            pack.product.categoryAr ?? "",
            pack.product.dosageForm?.nameEn ?? "",
            pack.product.dosageForm?.nameAr ?? "",
            pack.product.supplier?.nameEn ?? "",
            pack.product.supplier?.nameAr ?? "",
            pack.product.supplier?.code ?? "",
            pack.packCode,
            pack.packBarcode ?? "",
            pack.product.barcode ?? "",
            lot.batchNo,
          ].some((value) => value.toLowerCase().includes(search));
        })
        .map((lot) => ({
          key: `${pack.packId}::${lot.lotBatchId}`,
          pack,
          lot,
          label: `${pack.product.tradeNameEn ?? pack.product.nameEn} · Pack ${pack.packCode}`,
          subtitle: `${pack.product.genericNameEn ?? "Generic not set"} · ${pack.product.categoryEn ?? pack.product.dosageForm?.nameEn ?? "Unclassified"} · ${pack.product.supplier?.nameEn ?? "No supplier"}`,
          supporting: `Batch ${lot.batchNo} · ${lot.sellableQuantity} sellable · Exp ${formatDateLabel(lot.expiryDate)} · ${formatMoney(pack.product.defaultSalePrice ?? 0, "JOD")}`,
        })),
    );
  }, [catalogSearch, catalog]);

  const visibleFinalizedSales = useMemo(() => {
    const sales = Array.isArray(finalizedSales) ? finalizedSales : [];
    const search = salesSearch.trim().toLowerCase();
    if (!search) return sales;
    return sales.filter((sale) => {
      const sessionNumber = sale.posCartSession?.sessionNumber ?? "";
      const paymentMethod = sale.paymentFinalizations?.[0]?.paymentMethod ?? "";
      return [sale.documentNo, sessionNumber, paymentMethod, sale.state].some(
        (value) => value.toLowerCase().includes(search),
      );
    });
  }, [salesSearch, finalizedSales]);

  const selectedCatalogContext = useMemo(() => {
    const [packId, lotBatchId] = selectedCatalogKey.split("::");
    if (!packId || !lotBatchId) return null;
    const pack = catalog.find((item) => item.packId === packId);
    if (!pack) return null;
    const lot =
      pack.lots.find((item) => item.lotBatchId === lotBatchId) ?? null;
    return lot ? { pack, lot } : null;
  }, [selectedCatalogKey, catalog]);

  useEffect(() => {
    if (!selectedCatalogContext) {
      return;
    }
    setMaintenanceForm(buildMaintenanceFormFromSelection(selectedCatalogContext));
    setNewLinePrice(selectedCatalogContext.pack.product.defaultSalePrice ?? 0);
  }, [selectedCatalogContext]);

  const invoiceRows = useMemo(
    () =>
      safeCartLines.map((line) => {
        const taxRate = line.taxRate ?? 0;
        const beforeTaxTotal = Math.max(
          0,
          line.unitPrice * line.quantity - line.discount,
        );
        const taxValue = beforeTaxTotal * (taxRate / 100);
        const fallbackPack = catalog.find(
          (pack) => pack.packId === line.productPackId,
        );
        const fallbackLot = fallbackPack?.lots.find(
          (lot) => lot.lotBatchId === line.lotBatchId,
        );
        const resolvedPack =
          line.productPack ??
          (fallbackPack
            ? {
                code: fallbackPack.packCode,
                packBarcode:
                  fallbackPack.packBarcode ?? fallbackPack.product.barcode ?? null,
                packStatus: fallbackPack.packStatus ?? null,
                packSellability: fallbackPack.packSellability ?? null,
                unitsPerPack: fallbackPack.unitsPerPack ?? null,
                product: {
                  ...fallbackPack.product,
                  barcode: fallbackPack.product.barcode ?? null,
                },
              }
            : undefined);
        const resolvedLot =
          line.lotBatch ??
          (fallbackLot
            ? {
                batchNo: fallbackLot.batchNo,
                expiryDate: fallbackLot.expiryDate ?? null,
                status: fallbackLot.status ?? null,
                sellableQuantity: fallbackLot.sellableQuantity,
              }
            : null);
        return {
          ...line,
          productPack: resolvedPack,
          lotBatch: resolvedLot,
          beforeTaxTotal,
          taxValue,
          unitAfterTax: line.unitPrice * (1 + taxRate / 100),
          lineTotal: beforeTaxTotal + taxValue,
        };
      }),
    [catalog, safeCartLines],
  );

  const focusedInvoiceRow = useMemo(
    () =>
      invoiceRows.find((line) => line.id === focusedInvoiceLineId) ??
      invoiceRows[invoiceRows.length - 1] ??
      null,
    [focusedInvoiceLineId, invoiceRows],
  );

  const focusedProductSnapshot = useMemo<FocusedProductSnapshot | null>(() => {
    if (selectedCatalogContext) {
      return {
        title: selectedCatalogContext.pack.product.nameEn,
        subtitle: `${selectedCatalogContext.pack.product.nameAr} · Pack ${selectedCatalogContext.pack.packCode}`,
        batch: selectedCatalogContext.lot.batchNo,
        expiryLabel: formatDateLabel(selectedCatalogContext.lot.expiryDate),
        barcode:
          selectedCatalogContext.pack.packBarcode ??
          selectedCatalogContext.pack.product.barcode ??
          "Current runtime not exposed",
        packCode: selectedCatalogContext.pack.packCode,
        sellability:
          selectedCatalogContext.pack.packSellability ??
          selectedCatalogContext.lot.status ??
          "Runtime status not exposed",
        stockLabel: `${selectedCatalogContext.lot.sellableQuantity} sellable / ${selectedCatalogContext.lot.onHandQuantity ?? selectedCatalogContext.lot.sellableQuantity} on hand`,
        runtimeHonesty:
          "Generic, supplier/company, and dosage-form fields are not exposed by the current POS runtime yet.",
      };
    }

    if (selectedReturnSourceLine) {
      return {
        title: selectedReturnSourceLine.productPack.product.nameEn,
        subtitle: `${selectedReturnSourceLine.productPack.product.nameAr} · Return source line`,
        batch: selectedReturnSourceLine.lotBatch?.batchNo ?? "-",
        expiryLabel: "Return source runtime does not expose expiry here",
        barcode: "Return source runtime does not expose barcode here",
        packCode: "Return source pack context only",
        sellability: `Remaining eligible qty ${selectedReturnSourceLine.remainingQty}`,
        stockLabel: `Sold ${selectedReturnSourceLine.quantity} · Returned ${selectedReturnSourceLine.alreadyReturnedQty}`,
        runtimeHonesty:
          "Return detail keeps the legally relevant source-line relationship visible, but it does not expose full catalog metadata.",
      };
    }

    if (focusedInvoiceRow?.productPack) {
      return {
        title: focusedInvoiceRow.productPack.product.nameEn,
        subtitle: `${focusedInvoiceRow.productPack.product.nameAr} · Active sale line`,
        batch: focusedInvoiceRow.lotBatch?.batchNo ?? "-",
        expiryLabel: formatDateLabel(focusedInvoiceRow.lotBatch?.expiryDate),
        barcode:
          focusedInvoiceRow.productPack.packBarcode ??
          focusedInvoiceRow.productPack.product.barcode ??
          "Current runtime not exposed",
        packCode: focusedInvoiceRow.productPack.code,
        sellability:
          focusedInvoiceRow.productPack.packSellability ??
          focusedInvoiceRow.lotBatch?.status ??
          "Runtime status not exposed",
        stockLabel:
          focusedInvoiceRow.lotBatch?.sellableQuantity !== undefined
            ? `${focusedInvoiceRow.lotBatch.sellableQuantity} sellable in current lot view`
            : "Sellable lot quantity is not returned on this sale line payload",
        runtimeHonesty:
          "Active ingredient, supplier, and dosage-form fields still depend on backend catalog expansion, so the cashier surface labels those gaps honestly.",
      };
    }

    return null;
  }, [focusedInvoiceRow, selectedCatalogContext, selectedReturnSourceLine]);
  async function apiRequest<T>(
    path: string,
    init?: RequestInit,
    skipAuth = false,
  ): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    headers.set("Content-Type", "application/json");
    headers.set("x-tenant-id", tenantId);
    if (!skipAuth) {
      if (!token) throw new Error("Bearer token is required.");
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new Error(
        parseApiError(await response.json().catch(() => null), response.status),
      );
    }
    return (await response.json()) as T;
  }

  function bindCart(
    session: PosCartSession,
    preferredLineId?: string | null,
  ) {
    const normalizedLines = Array.isArray(session.lines) ? session.lines : [];
    setCartSession({ ...session, lines: normalizedLines });
    const edits: Record<string, LineEditState> = {};
    for (const line of normalizedLines) {
      edits[line.id] = {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate ?? 0,
      };
    }
    setLineEdits(edits);
    const nextFocusedLineId =
      preferredLineId && normalizedLines.some((line) => line.id === preferredLineId)
        ? preferredLineId
        : normalizedLines[normalizedLines.length - 1]?.id ?? "";
    setFocusedInvoiceLineId(nextFocusedLineId);
  }

  function resetReturnWorkspace() {
    setSelectedSaleId("");
    setSelectedSaleDetail(null);
    setReturnSession(null);
    setReturnSourceLineId("");
    setReturnQuantity(1);
    setReturnUnitPrice(0);
    setReturnFinalizedAt(null);
    setFinalizedReturnSummary(null);
    setReturnError(null);
    setSecondaryPane("lookup");
    setFocusedInvoiceLineId("");
    setWorkspaceView("returns");
  }

  function scrollToSection(sectionId: string) {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleHeaderPrimaryAction() {
    if (operatorActionState === "setup") {
      void performLogin();
      return;
    }
    if (operatorActionState === "load-workspace") {
      void loadContextAndCatalog();
      return;
    }
    if (operatorActionState === "resume-sale") {
      setWorkspaceView("cashier");
      return;
    }
    if (operatorActionState === "return-mode") {
      setWorkspaceView("returns");
      setSecondaryPane(returnSession || finalizedReturnSummary ? "return" : "lookup");
      return;
    }
    setWorkspaceView("cashier");
    void createCartSession();
  }

  function handleHeaderSecondaryAction() {
    if (!workspaceReady) {
      scrollToSection("utility-diagnostics");
      return;
    }
    if (returnFocusMode) {
      setWorkspaceView("returns");
      setSecondaryPane(returnSession || finalizedReturnSummary ? "return" : "lookup");
      return;
    }
    setWorkspaceView("search");
  }

  const headerPrimaryLabel =
    operatorActionState === "setup"
      ? "Authenticate operator"
      : operatorActionState === "load-workspace"
        ? "Load workspace"
        : operatorActionState === "resume-sale"
          ? "Resume current sale"
          : operatorActionState === "return-mode"
            ? "Continue return work"
            : "Start new sale";

  const headerSecondaryLabel = !workspaceReady
    ? "Open setup tools"
    : returnFocusMode
      ? "Open returns workspace"
      : "Open product lookup";

  async function performLogin() {
    setContextError(null);
    try {
      const payload = await apiRequest<{ access_token: string }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password, tenantId }),
        },
        true,
      );
      setToken(payload.access_token);
      setStatusMessage("Operator session authenticated successfully.");
    } catch (error) {
      setContextError((error as Error).message);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    await performLogin();
  }

  async function loadSuppliers() {
    try {
      const records = await apiRequest<SupplierOption[]>(
        "/suppliers?isActive=true",
      );
      setSuppliers(Array.isArray(records) ? records : []);
    } catch {
      setSuppliers([]);
    }
  }

  function handleCatalogSelection(nextKey: string) {
    setSelectedCatalogKey(nextKey);
  }

  function updateMaintenanceField<K extends keyof MaintenanceFormState>(
    key: K,
    value: MaintenanceFormState[K],
  ) {
    setMaintenanceForm((current) => ({ ...current, [key]: value }));
  }

  function validateMaintenanceForm() {
    if (!maintenanceForm.tradeNameEn.trim()) {
      return "Trade / commercial name is required.";
    }
    if (!maintenanceForm.barcode.trim()) {
      return "Barcode is required.";
    }
    if (!maintenanceForm.strength.trim()) {
      return "Strength is required.";
    }
    if (!maintenanceForm.packSize.trim()) {
      return "Pack is required.";
    }
    if (!maintenanceForm.dosageFormName.trim()) {
      return "Dosage form is required.";
    }
    if (!maintenanceForm.batchNo.trim()) {
      return "Batch number is required so the saved product can be sold truthfully.";
    }
    const price = Number(maintenanceForm.defaultSalePrice);
    if (!Number.isFinite(price) || price < 0) {
      return "Before-tax price must be zero or greater.";
    }
    const stock = Number(maintenanceForm.branchStockQuantity);
    if (!Number.isInteger(stock) || stock < 0) {
      return "Branch stock quantity must be a whole number zero or greater.";
    }
    return null;
  }

  async function saveMaintenanceRecord() {
    setMaintenanceError(null);
    setMaintenanceSuccess(null);
    if (!workspaceReady) {
      setMaintenanceError("Load the workspace before saving product truth.");
      return;
    }

    const validationError = validateMaintenanceForm();
    if (validationError) {
      setMaintenanceError(validationError);
      return;
    }

    const payload = {
      branchId,
      nameEn: maintenanceForm.tradeNameEn.trim(),
      nameAr: maintenanceForm.tradeNameAr.trim() || maintenanceForm.tradeNameEn.trim(),
      tradeNameEn: maintenanceForm.tradeNameEn.trim(),
      tradeNameAr: maintenanceForm.tradeNameAr.trim() || maintenanceForm.tradeNameEn.trim(),
      genericNameEn: maintenanceForm.genericNameEn.trim() || undefined,
      genericNameAr: maintenanceForm.genericNameAr.trim() || undefined,
      categoryEn: maintenanceForm.categoryEn.trim() || undefined,
      categoryAr: maintenanceForm.categoryAr.trim() || undefined,
      strength: maintenanceForm.strength.trim(),
      dosageFormName: maintenanceForm.dosageFormName.trim(),
      packSize: maintenanceForm.packSize.trim(),
      barcode: maintenanceForm.barcode.trim(),
      supplierId: maintenanceForm.supplierId || undefined,
      defaultSalePrice: Number(maintenanceForm.defaultSalePrice),
      taxProfileCode: maintenanceForm.taxProfileCode.trim() || undefined,
      packCode: maintenanceForm.packCode.trim() || undefined,
      packBarcode: maintenanceForm.packBarcode.trim() || undefined,
      batchNo: maintenanceForm.batchNo.trim(),
      expiryDate: maintenanceForm.expiryDate || undefined,
      branchStockQuantity: Number(maintenanceForm.branchStockQuantity),
      isActive: maintenanceForm.isActive,
    };

    try {
      const response = await apiRequest<{
        product: CatalogPack["product"] & {
          runtime?: {
            productPackId: string;
            lotBatchId: string;
          } | null;
        };
      }>(
        maintenanceForm.productId
          ? `/products/${maintenanceForm.productId}/maintenance`
          : "/products/maintenance",
        {
          method: maintenanceForm.productId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      await loadContextAndCatalog();
      if (response.product.runtime?.productPackId && response.product.runtime?.lotBatchId) {
        handleCatalogSelection(
          `${response.product.runtime.productPackId}::${response.product.runtime.lotBatchId}`,
        );
      }
      setMaintenanceSuccess(
        maintenanceForm.productId
          ? "Product maintenance was persisted and rebound to the live runtime."
          : "New product truth was created, stocked, and bound to the live runtime.",
      );
      setStatusMessage("Product truth persisted through the current architecture.");
      setWorkspaceView("maintenance");
    } catch (error) {
      setMaintenanceError((error as Error).message);
    }
  }

  function startNewMaintenanceRecord() {
    setSelectedCatalogKey("");
    setMaintenanceError(null);
    setMaintenanceSuccess(null);
    setMaintenanceForm(emptyMaintenanceForm());
  }

  async function loadContextAndCatalog() {
    setContextError(null);
    try {
      const ctx = await apiRequest<PosContextResponse>(
        `/pos/operational/context?branchId=${encodeURIComponent(branchId)}`,
      );
      setContext(ctx);
      const resolvedRegister =
        registerId ||
        ctx.defaultRegisterId ||
        ctx.registers.find((item) => item.branchId === branchId)?.id ||
        "";
      setRegisterId(resolvedRegister);
      setLegalEntityId(
        ctx.registers.find((item) => item.id === resolvedRegister)
          ?.legalEntityId ?? "",
      );

      const packs = await apiRequest<CatalogPack[]>(
        `/pos/operational/catalog?branchId=${encodeURIComponent(branchId)}&search=${encodeURIComponent(catalogSearch)}`,
      );
      const normalizedPacks = Array.isArray(packs) ? packs : [];
      setCatalog(normalizedPacks);
      if (!selectedCatalogKey && normalizedPacks[0]?.lots[0]) {
        handleCatalogSelection(
          `${normalizedPacks[0].packId}::${normalizedPacks[0].lots[0].lotBatchId}`,
        );
      }

      await loadSuppliers();

      const carts = await apiRequest<OpenCartSession[]>(
        `/pos/operational/cart-sessions?branchId=${encodeURIComponent(branchId)}&registerId=${encodeURIComponent(resolvedRegister)}`,
      );
      setOpenCarts(Array.isArray(carts) ? carts : []);

      const sales = await apiRequest<FinalizedSaleSummary[]>(
        `/pos/operational/finalized-sales?branchId=${encodeURIComponent(branchId)}&registerId=${encodeURIComponent(resolvedRegister)}&search=${encodeURIComponent(salesSearch)}`,
      );
      setFinalizedSales(Array.isArray(sales) ? sales : []);
      setStatusMessage("Workspace loaded from the accepted backend runtime with product truth and maintenance persistence.");
    } catch (error) {
      setContextError((error as Error).message);
    }
  }

  async function createCartSession() {
    setCartError(null);
    if (!registerId) {
      setCartError("Register is required before creating cart session.");
      return;
    }

    try {
      const created = await apiRequest<PosCartSession>(
        "/pos/operational/cart-sessions",
        {
          method: "POST",
          body: JSON.stringify({
            branchId,
            registerId,
            legalEntityId: legalEntityId || undefined,
            currency: "JOD",
            notes: "Stage 8.33A concept A cashier counter shell",
          }),
        },
      );
      bindCart(created);
      setWorkspaceView("cashier");
      setStatusMessage(`New sale started: ${created.sessionNumber}`);
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function openCartSession(
    cartSessionId: string,
    preferredLineId?: string | null,
  ) {
    setCartError(null);
    try {
      bindCart(
        await apiRequest<PosCartSession>(
          `/pos/operational/cart-sessions/${cartSessionId}`,
        ),
        preferredLineId,
      );
      setWorkspaceView("cashier");
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function addCartLine() {
    setCartError(null);
    if (!cartSession) {
      setCartError("Start or open a sale first.");
      return;
    }
    if (!isCartMutable) {
      setCartError("Finalized sale is immutable.");
      return;
    }

    const [packId, lotBatchId] = selectedCatalogKey.split("::");
    if (!packId || !lotBatchId) {
      setCartError("Select product pack + lot first.");
      return;
    }

    try {
      await apiRequest(
        `/pos/operational/cart-sessions/${cartSession.id}/lines`,
        {
          method: "POST",
          body: JSON.stringify({
            productPackId: packId,
            lotBatchId,
            quantity: newLineQty,
            unitPrice: newLinePrice,
            discount: 0,
            taxRate: 0,
          }),
        },
      );
      await openCartSession(cartSession.id, null);
      setStatusMessage("Sale line added.");
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function updateCartLine(lineId: string) {
    if (!cartSession) return;
    const edit = lineEdits[lineId];
    if (!edit) return;
    setCartError(null);
    try {
      bindCart(
        await apiRequest<PosCartSession>(
          `/pos/operational/cart-sessions/${cartSession.id}/lines/${lineId}`,
          {
            method: "PATCH",
            body: JSON.stringify(edit),
          },
        ),
        lineId,
      );
      setStatusMessage("Sale line updated.");
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function removeCartLine(lineId: string) {
    if (!cartSession) return;
    setCartError(null);
    try {
      bindCart(
        await apiRequest<PosCartSession>(
          `/pos/operational/cart-sessions/${cartSession.id}/lines/${lineId}`,
          {
            method: "DELETE",
          },
        ),
        focusedInvoiceLineId === lineId ? null : focusedInvoiceLineId,
      );
      setStatusMessage("Sale line removed.");
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function finalizeCashSale() {
    if (!cartSession) return;
    setCartError(null);
    const amountApplied = Number(cartSession.grandTotal.toFixed(2));
    const amountTendered = cashTendered
      ? Number(Number(cashTendered).toFixed(2))
      : amountApplied;
    try {
      await apiRequest(
        `/pos/operational/cart-sessions/${cartSession.id}/finalize-cash`,
        {
          method: "POST",
          body: JSON.stringify({ amountApplied, amountTendered }),
        },
      );
      bindCart(
        await apiRequest<PosCartSession>(
          `/pos/operational/cart-sessions/${cartSession.id}`,
        ),
        focusedInvoiceLineId,
      );
      await refreshFinalizedSales();
      setStatusMessage("Cash sale finalized.");
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function refreshFinalizedSales() {
    setReturnError(null);
    try {
      setFinalizedSales(
        await apiRequest<FinalizedSaleSummary[]>(
          `/pos/operational/finalized-sales?branchId=${encodeURIComponent(branchId)}&registerId=${encodeURIComponent(registerId)}&search=${encodeURIComponent(salesSearch)}`,
        ),
      );
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function loadSaleDetail(saleId: string) {
    setReturnError(null);
    setSelectedSaleId(saleId);
    setReturnSession(null);
    setReturnFinalizedAt(null);
    setFinalizedReturnSummary(null);
    setSecondaryPane("lookup");
    setWorkspaceView("returns");
    try {
      setSelectedSaleDetail(
        await apiRequest<FinalizedSaleDetail | null>(
          `/pos/operational/finalized-sales/${saleId}`,
        ),
      );
      setReturnSourceLineId("");
      setReturnQuantity(1);
      setReturnUnitPrice(0);
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function createReturnSession() {
    if (!selectedSaleDetail) {
      setReturnError("Load a finalized sale first.");
      return;
    }
    if (!registerId) {
      setReturnError("Register is required.");
      return;
    }
    if (!["FINALIZED", "ACCEPTED"].includes(selectedSaleDetail.state)) {
      setReturnError("Only finalized sales can start returns.");
      return;
    }

    setReturnError(null);
    setReturnFinalizedAt(null);
    setFinalizedReturnSummary(null);
    try {
      setReturnSession(
        await apiRequest<PosReturnSession>("/pos/operational/return-sessions", {
          method: "POST",
          body: JSON.stringify({
            branchId,
            registerId,
            legalEntityId: legalEntityId || undefined,
            sourceSaleDocumentId: selectedSaleDetail.id,
            reasonCode: "POS_RETURN",
            currency: selectedSaleDetail.currency,
          }),
        }),
      );
      setSecondaryPane("return");
      setWorkspaceView("returns");
      setStatusMessage("Return draft created against the selected sale.");
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function addReturnLine() {
    if (!selectedSaleDetail || !returnSession) {
      setReturnError("Create a return draft and select a source line first.");
      return;
    }
    if (returnSession.state !== "OPEN") {
      setReturnError("Return session is not mutable.");
      return;
    }

    const source = safeSelectedSaleLines.find(
      (line) => line.id === returnSourceLineId,
    );
    if (!source || !source.lotBatchId) {
      setReturnError("Select a valid source sale line.");
      return;
    }

    setReturnError(null);
    try {
      await apiRequest(
        `/pos/operational/return-sessions/${returnSession.id}/lines`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceSaleLineId: source.id,
            productPackId: source.productPackId,
            lotBatchId: source.lotBatchId,
            quantityReturned: returnQuantity,
            unitPrice: returnUnitPrice,
            discount: source.discount,
            taxRate: source.taxRate ?? 0,
            reasonCode: "POS_RETURN_LINE",
          }),
        },
      );
      setReturnSession(
        await apiRequest<PosReturnSession>(
          `/pos/operational/return-sessions/${returnSession.id}`,
        ),
      );
      setStatusMessage("Return line added.");
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function finalizeReturn() {
    if (!returnSession) return;
    setReturnError(null);
    try {
      const activeSaleDetail = selectedSaleDetail;
      await apiRequest(
        `/pos/operational/return-sessions/${returnSession.id}/finalize`,
        {
          method: "POST",
          body: JSON.stringify({
            refundAmount: Number(returnSession.grandTotal.toFixed(2)),
          }),
        },
      );
      const finalizedSession = await apiRequest<PosReturnSession>(
        `/pos/operational/return-sessions/${returnSession.id}`,
      );
      const finalizedAt = new Date().toISOString();
      setReturnSession(finalizedSession);
      setReturnFinalizedAt(finalizedAt);
      setFinalizedReturnSummary({
        returnReference:
          finalizedSession.fiscalReturnDocument?.documentNo ??
          finalizedSession.returnNumber,
        returnSessionNumber: finalizedSession.returnNumber,
        sourceSaleReference: activeSaleDetail?.documentNo ?? selectedSaleId,
        sourceSessionReference:
          activeSaleDetail?.posCartSession?.sessionNumber ?? null,
        amount: finalizedSession.grandTotal,
        currency: finalizedSession.currency,
        finalizedAt,
      });
      if (activeSaleDetail) {
        setSelectedSaleDetail(
          await apiRequest<FinalizedSaleDetail | null>(
            `/pos/operational/finalized-sales/${activeSaleDetail.id}`,
          ),
        );
      }
      await refreshFinalizedSales();
      setSecondaryPane("return");
      setWorkspaceView("returns");
      setStatusMessage("Return finalized.");
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  const searchMeta = searchModeMeta[catalogSearchMode];
  const pharmacistAlerts = [
    {
      title: "Pharmacist review lane",
      body: focusedProductSnapshot
        ? `${focusedProductSnapshot.title} is in focus. ${focusedProductSnapshot.runtimeHonesty}`
        : "This lane stays visible but secondary. It reserves space for pharmacist review cues without interrupting checkout.",
      tone: "sky" as const,
    },
    {
      title: "Batch and expiry awareness",
      body: focusedProductSnapshot
        ? `Batch ${focusedProductSnapshot.batch} · Expiry ${focusedProductSnapshot.expiryLabel}. This remains an operator/pharmacist cue, not a hard clinical stop.`
        : "Batch and expiry visibility appears here once a pack or sale line is in focus.",
      tone: "amber" as const,
    },
    {
      title: "Compliance guardrail",
      body:
        "Tax-code, JoFotara, controlled-substance, and legal hard-stop behavior are still pending backend compliance work. This cashier surface does not fake those completions.",
      tone: "info" as const,
    },
  ];
  const visibleSearchResults = visibleCatalogOptions.slice(0, 12);

  const workspaceTabs: Array<{
    id: PosWorkspaceView;
    label: string;
    note: string;
    activeClass: string;
  }> = [
    {
      id: "cashier",
      label: "Sell Counter",
      note: "Live invoice workstation",
      activeClass: "border-emerald-500/60 bg-emerald-500/10 text-emerald-50",
    },
    {
      id: "search",
      label: "Lookup Bench",
      note: "Trade, generic, supplier, category",
      activeClass: "border-amber-500/60 bg-amber-500/10 text-amber-50",
    },
    {
      id: "maintenance",
      label: "Pricing Desk",
      note: "Classification and maintenance",
      activeClass: "border-sky-500/60 bg-sky-500/10 text-sky-50",
    },
    {
      id: "returns",
      label: "Returns",
      note: "Lookup and refund execution",
      activeClass: "border-rose-500/60 bg-rose-500/10 text-rose-50",
    },
  ];
  const invoiceReference =
    cartSession?.fiscalSaleDocument?.documentNo ??
    cartSession?.sessionNumber ??
    "No active invoice";
  const stripStatusLabel = contextError || cartError || returnError
    ? "Needs attention"
    : workspaceReady
      ? returnFocusMode
        ? "Returns ready"
        : cartSession
          ? cartSession.state === "FINALIZED"
            ? "Closed bill"
            : cartSession.state
          : "Ready"
      : operatorAuthenticated
        ? "Load workspace"
        : "Auth required";
  const workspaceModeLabel =
    workspaceView === "cashier"
      ? cartSession?.state === "FINALIZED"
        ? "Closed sale"
        : "Cash sale"
      : workspaceView === "search"
        ? "Lookup"
        : workspaceView === "maintenance"
          ? "Pricing review"
          : "Returns";
  const shiftLabel = returnFocusMode
    ? finalizedReturnSummary?.returnSessionNumber ??
      returnSession?.returnNumber ??
      "Return flow"
    : cartSession?.sessionNumber ?? "No active shift";
  const selectedPackLabel = selectedCatalogContext
    ? `${selectedCatalogContext.pack.product.nameEn} · Pack ${selectedCatalogContext.pack.packCode}`
    : focusedInvoiceRow?.productPack
      ? `${focusedInvoiceRow.productPack.product.nameEn} · Pack ${focusedInvoiceRow.productPack.code}`
      : "No pack selected";
  const selectedLotLabel = selectedCatalogContext
    ? selectedCatalogContext.lot.batchNo
    : focusedInvoiceRow?.lotBatch?.batchNo ?? "No lot selected";
  const selectedExpiryLabel = selectedCatalogContext
    ? formatDateLabel(selectedCatalogContext.lot.expiryDate)
    : formatDateLabel(focusedInvoiceRow?.lotBatch?.expiryDate);
  return (
    <main
      className="min-h-screen bg-[#0f1318] text-slate-100"
      style={{
        fontFamily: '"Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif',
      }}
    >
      <div className="mx-auto max-w-[1560px] space-y-2 px-4 py-3 lg:px-6 lg:py-4">
        <header>
          <section className={cn(surfaceClass, "space-y-2 px-3 py-3")}>
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
                  Pharmacy cashier / accounting counter
                </p>
                <div className="flex flex-col gap-1 xl:flex-row xl:items-end xl:justify-between">
                  <h1 className="text-[1.4rem] font-semibold tracking-[0.01em] text-slate-50 lg:text-[1.75rem]">
                    Classic Pharmacy Cashier Counter
                  </h1>
                  <p className="max-w-3xl text-xs leading-5 text-slate-400">
                    Thin operational chrome only. The live invoice stays primary; lookup, pricing, and returns remain purpose-built side workspaces.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <button
                  className={primaryButtonClass}
                  type="button"
                  onClick={handleHeaderPrimaryAction}
                  disabled={
                    operatorActionState === "start-sale" && !workspaceReady
                  }
                >
                  {headerPrimaryLabel}
                </button>
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={handleHeaderSecondaryAction}
                >
                  {headerSecondaryLabel}
                </button>
              </div>
            </div>

            <div className="grid gap-2 xl:grid-cols-4">
              {workspaceTabs.map((tab) => {
                const isActive = workspaceView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWorkspaceView(tab.id)}
                    className={cn(
                      "rounded-[8px] border border-slate-800 bg-[#11161d] px-3 py-2.5 text-left transition",
                      isActive
                        ? tab.activeClass
                        : "text-slate-300 hover:border-slate-600 hover:bg-[#161d27] hover:text-slate-100",
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {tab.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{tab.note}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 xl:grid-cols-[1.15fr_1.25fr_1fr_1fr_0.9fr]">
              {[
                {
                  label: "Operator",
                  value: operatorAuthenticated ? email : "Pending sign-in",
                },
                {
                  label: "Register",
                  value: activeRegister
                    ? `${activeRegister.code} · ${activeBranch?.name ?? "Branch"}`
                    : "Register not loaded",
                },
                { label: "Shift", value: shiftLabel },
                { label: "Status", value: stripStatusLabel },
                { label: "Mode", value: workspaceModeLabel },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[8px] border border-slate-800 bg-[#11161d] px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <details
              id="utility-diagnostics"
              className="rounded-[8px] border border-slate-800 bg-[#10151c] px-3 py-3 text-sm text-slate-300"
            >
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Utility setup and diagnostics
              </summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <form
                  className="space-y-3 rounded-[8px] border border-slate-800 bg-[#151b22] p-3"
                  onSubmit={login}
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Operator sign-in defaults
                    </h3>
                    <p className="text-xs leading-5 text-slate-400">
                      Setup remains subordinate until the counter actually needs it.
                    </p>
                  </div>
                  <input className={inputClass} placeholder="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
                  <input className={inputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input className={inputClass} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button className={primaryButtonClass} type="submit">Sign in</button>
                </form>

                <div className="space-y-3 rounded-[8px] border border-slate-800 bg-[#151b22] p-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-100">Advanced overrides</h3>
                    <p className="text-xs leading-5 text-slate-400">Used only for branch, register, or token troubleshooting.</p>
                  </div>
                  <input className={inputClass} placeholder="Branch ID" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
                  <input className={inputClass} placeholder="Register ID" value={registerId} onChange={(e) => setRegisterId(e.target.value)} />
                  <input className={inputClass} placeholder="Technical bearer token (advanced only)" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
                  <p className="text-xs leading-5 text-slate-500">The live token stays masked. Diagnostics never become the counter headline.</p>
                </div>
              </div>
            </details>

            {contextError ? (
              <Notice title="Setup blocked" body={contextError} tone="error" />
            ) : null}
            {statusMessage ? (
              <Notice title="Latest operation" body={statusMessage} tone="success" />
            ) : null}
          </section>
        </header>
        {workspaceView === "cashier" ? (
          <>
            <section id="sale-workspace" className={cn(surfaceClass, "p-3 lg:p-4")}>
            <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_290px]">
              <div className="space-y-3">
                <section className="rounded-[10px] border border-slate-800 bg-[#10151c]">
                  <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ToneBadge tone={workspaceReady ? "emerald" : "rose"}>
                          Sell counter
                        </ToneBadge>
                        {cartSession ? (
                          <ToneBadge tone={stateTone(cartSession.state)}>
                            {cartSession.state}
                          </ToneBadge>
                        ) : (
                          <ToneBadge tone="slate">Idle</ToneBadge>
                        )}
                      </div>
                      <h2 className="text-[1.55rem] font-semibold tracking-[0.02em] text-slate-50">
                        {invoiceReference}
                      </h2>
                      <p className="text-xs leading-5 text-slate-400">
                        Search or scan, bind the correct pack and lot, post the line into the live invoice, then close the bill from the cashier footer.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={createCartSession}
                        disabled={!workspaceReady}
                      >
                        Start new sale
                      </button>
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={loadContextAndCatalog}
                        disabled={!workspaceReady}
                      >
                        Refresh workspace data
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 border-b border-slate-800 bg-[#0d1218] px-4 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,240px)_90px_120px_auto]">
                    <input
                      className={inputClass}
                      placeholder="Scan barcode / Search product, generic, barcode..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                    />
                    <select
                      className={inputClass}
                      value={selectedCatalogKey}
                      onChange={(e) => handleCatalogSelection(e.target.value)}
                      disabled={!cartSession || !isCartMutable}
                    >
                      <option value="">Select product pack and lot</option>
                      {visibleCatalogOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label + " · " + option.subtitle}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputClass}
                      min={1}
                      step={1}
                      type="number"
                      value={newLineQty}
                      onChange={(e) =>
                        setNewLineQty(Number(e.target.value) || 1)
                      }
                      disabled={!cartSession || !isCartMutable}
                    />
                    <input
                      className={inputClass}
                      min={0}
                      step={0.01}
                      type="number"
                      value={newLinePrice}
                      onChange={(e) =>
                        setNewLinePrice(Number(e.target.value) || 0)
                      }
                      disabled={!cartSession || !isCartMutable}
                    />
                    <button
                      className={primaryButtonClass}
                      type="button"
                      onClick={addCartLine}
                      disabled={!cartSession || !isCartMutable}
                    >
                      Add line
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-slate-500 lg:flex-row lg:items-center lg:justify-between">
                    <p>Lookup and pricing stay outside the live invoice lane so the counter remains narrow and operational.</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={() => setWorkspaceView("search")}
                      >
                        Search workspace
                      </button>
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={() => setWorkspaceView("maintenance")}
                      >
                        Pricing workspace
                      </button>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-[10px] border border-slate-800 bg-[#10151c]">
                  <div className="grid grid-cols-[2.35fr_1.25fr_0.9fr_0.6fr_0.9fr_0.7fr_0.9fr_1fr] gap-3 border-b border-slate-800 bg-[#0d1218] px-4 py-2">
                    <InvoiceHeaderCell>Item</InvoiceHeaderCell>
                    <InvoiceHeaderCell>Pack/Strength</InvoiceHeaderCell>
                    <InvoiceHeaderCell>Batch</InvoiceHeaderCell>
                    <InvoiceHeaderCell align="right">Qty</InvoiceHeaderCell>
                    <InvoiceHeaderCell align="right">Pre-tax</InvoiceHeaderCell>
                    <InvoiceHeaderCell align="right">Tax</InvoiceHeaderCell>
                    <InvoiceHeaderCell align="right">After-tax</InvoiceHeaderCell>
                    <InvoiceHeaderCell align="right">Line total</InvoiceHeaderCell>
                  </div>

                  <div className="max-h-[540px] divide-y divide-slate-800 overflow-y-auto bg-[#10151c]">
                    {invoiceRows.length ? (
                      invoiceRows.map((line) => {
                        const edit = lineEdits[line.id] ?? {
                          quantity: line.quantity,
                          unitPrice: line.unitPrice,
                          discount: line.discount,
                          taxRate: line.taxRate ?? 0,
                        };
                        const isFocused = line.id === focusedInvoiceRow?.id;
                        return (
                          <div
                            key={line.id}
                            className={cn(
                              "cursor-pointer border-l-[3px] px-3 py-3 transition",
                              isFocused
                                ? "border-amber-400/80 bg-[#18212c]"
                                : "border-transparent bg-[#10151c] hover:bg-[#151c26]",
                            )}
                            onClick={() => setFocusedInvoiceLineId(line.id)}
                          >
                            <div className="grid grid-cols-[2.35fr_1.25fr_0.9fr_0.6fr_0.9fr_0.7fr_0.9fr_1fr] items-start gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-100">
                                    {line.productPack?.product.nameEn ??
                                      "Product pack"}
                                  </p>
                                  {isFocused ? (
                                    <ToneBadge tone="sky">Focused</ToneBadge>
                                  ) : null}
                                </div>
                                <p className="text-xs text-slate-400">
                                  {line.productPack?.product.nameAr ?? "منتج"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Generic / active ingredient stays honest: not
                                  exposed on the current POS runtime payload.
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-100">
                                  {line.productPack?.code
                                    ? "Pack " + line.productPack.code
                                    : "Runtime not exposed"}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {line.productPack?.unitsPerPack
                                    ? String(line.productPack.unitsPerPack) +
                                      " units per pack"
                                    : "Strength/form pending runtime"}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-100">
                                  {line.lotBatch?.batchNo ?? "-"}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Exp {formatDateLabel(line.lotBatch?.expiryDate)}
                                </p>
                              </div>
                              <div className="text-right text-sm font-semibold text-slate-100">
                                {line.quantity}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-100">
                                  {formatMoney(
                                    line.unitPrice,
                                    cartSession?.currency ?? "JOD",
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Base{" "}
                                  {formatMoney(
                                    line.beforeTaxTotal,
                                    cartSession?.currency ?? "JOD",
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-100">
                                  {(line.taxRate ?? 0) + "%"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {formatMoney(
                                    line.taxValue,
                                    cartSession?.currency ?? "JOD",
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-100">
                                  {formatMoney(
                                    line.unitAfterTax,
                                    cartSession?.currency ?? "JOD",
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Per unit
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-100">
                                  {formatMoney(
                                    line.lineTotal,
                                    cartSession?.currency ?? "JOD",
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Discount{" "}
                                  {formatMoney(
                                    line.discount,
                                    cartSession?.currency ?? "JOD",
                                  )}
                                </p>
                              </div>
                            </div>

                            {isCartMutable && isFocused ? (
                              <div className="mt-3 rounded-[8px] border border-slate-700 bg-[#0c1117] px-3 py-3">
                                <div className="grid gap-2 xl:grid-cols-[0.65fr_0.9fr_0.8fr_0.75fr_auto_auto]">
                                  <label className={metricCardClass}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Qty
                                    </p>
                                    <input
                                      className="mt-1.5 h-9 w-full rounded-[6px] border border-slate-700 bg-[#10151c] px-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/70"
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={edit.quantity}
                                      onChange={(e) =>
                                        setLineEdits((cur) => ({
                                          ...cur,
                                          [line.id]: {
                                            ...edit,
                                            quantity:
                                              Number(e.target.value) || 1,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className={metricCardClass}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Before tax
                                    </p>
                                    <input
                                      className="mt-1.5 h-9 w-full rounded-[6px] border border-slate-700 bg-[#10151c] px-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/70"
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={edit.unitPrice}
                                      onChange={(e) =>
                                        setLineEdits((cur) => ({
                                          ...cur,
                                          [line.id]: {
                                            ...edit,
                                            unitPrice:
                                              Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className={metricCardClass}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Discount
                                    </p>
                                    <input
                                      className="mt-1.5 h-9 w-full rounded-[6px] border border-slate-700 bg-[#10151c] px-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/70"
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={edit.discount}
                                      onChange={(e) =>
                                        setLineEdits((cur) => ({
                                          ...cur,
                                          [line.id]: {
                                            ...edit,
                                            discount:
                                              Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className={metricCardClass}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Tax %
                                    </p>
                                    <input
                                      className="mt-1.5 h-9 w-full rounded-[6px] border border-slate-700 bg-[#10151c] px-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/70"
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={edit.taxRate}
                                      onChange={(e) =>
                                        setLineEdits((cur) => ({
                                          ...cur,
                                          [line.id]: {
                                            ...edit,
                                            taxRate:
                                              Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <button
                                    className={secondaryButtonClass}
                                    type="button"
                                    onClick={() => updateCartLine(line.id)}
                                  >
                                    Update line
                                  </button>
                                  <button
                                    className="inline-flex h-10 items-center justify-center rounded-[8px] border border-rose-500/40 bg-rose-500/10 px-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-500/20"
                                    type="button"
                                    onClick={() => removeCartLine(line.id)}
                                  >
                                    Remove line
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <EmptyPanel
                        title="No sale lines yet"
                        body="Authenticate the operator, load the workspace, start a sale, then push the first scanned pack into the invoice lane."
                      />
                    )}
                  </div>

                  <div className="sticky bottom-0 border-t border-amber-500/20 bg-[#0f141b]/95 px-4 py-3 backdrop-blur">
                    <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_220px_auto_auto] xl:items-end">
                      <div className="rounded-[8px] border border-slate-800 bg-[#10151c] px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Subtotal
                        </p>
                        <p className="mt-1.5 text-[1.05rem] font-semibold text-slate-50">
                          {formatMoney(
                            cartSession?.subtotal ?? 0,
                            cartSession?.currency ?? "JOD",
                          )}
                        </p>
                      </div>
                      <div className="rounded-[8px] border border-slate-800 bg-[#10151c] px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Tax
                        </p>
                        <p className="mt-1.5 text-[1.05rem] font-semibold text-slate-50">
                          {formatMoney(
                            cartSession?.taxTotal ?? 0,
                            cartSession?.currency ?? "JOD",
                          )}
                        </p>
                      </div>
                      <div className="rounded-[8px] border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                          Amount due
                        </p>
                        <p className="mt-1.5 text-[1.3rem] font-semibold text-slate-50">
                          {formatMoney(
                            cartSession?.grandTotal ?? 0,
                            cartSession?.currency ?? "JOD",
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Tendered cash
                        </label>
                        <input
                          className={inputClass}
                          placeholder="Cash tendered"
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          disabled={!isCartMutable}
                        />
                      </div>
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        disabled
                        title="Suspend / hold is not wired on this POS runtime yet."
                      >
                        Hold pending
                      </button>
                      <div className="flex gap-2 xl:justify-end">
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          disabled
                          title="Clear / cancel is not wired on this POS runtime yet."
                        >
                          Clear pending
                        </button>
                        <button
                          className={accentButtonClass}
                          type="button"
                          onClick={finalizeCashSale}
                          disabled={!isCartMutable}
                        >
                          Finalize cash sale
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Hold, suspend, and clear remain visibly secondary and are
                      labeled pending until the runtime actually exposes them.
                    </p>
                    {cartSession?.state === "FINALIZED" ? (
                      <div className="mt-3 rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        Bill closed. Fiscal reference{" "}
                        {cartSession.fiscalSaleDocument?.documentNo ??
                          cartSession.sessionNumber}{" "}
                        stays visible here so the footer reads like a finalized
                        cashier bill.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="space-y-3">
                <section className="rounded-[10px] border border-amber-900/50 bg-[#120f0b] p-4">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Pack / Lot selector
                    </p>
                    <h3 className="text-lg font-semibold text-slate-50">
                      Selected pack and lot stay adjacent to the bill.
                    </h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    <li>Selected pack: {selectedPackLabel}</li>
                    <li>Lot: {selectedLotLabel}</li>
                    <li>Expiry: {selectedExpiryLabel}</li>
                  </ul>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Open sale session
                      </label>
                      <select
                        className={inputClass}
                        value=""
                        onChange={(e) =>
                          e.target.value && void openCartSession(e.target.value)
                        }
                        disabled={!workspaceReady || !safeOpenCarts.length}
                      >
                        <option value="">Select an open sale</option>
                        {safeOpenCarts.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.sessionNumber +
                              " · " +
                              formatMoney(item.grandTotal, "JOD")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={() => setWorkspaceView("search")}
                      >
                        Open search
                      </button>
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={() => setWorkspaceView("maintenance")}
                      >
                        Open pricing
                      </button>
                    </div>
                  </div>
                </section>

                <section className={cn(mutedSurfaceClass, "p-4")}>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Quick info
                    </p>
                    <h3 className="text-lg font-semibold text-slate-50">
                      Runtime-backed cues only.
                    </h3>
                  </div>
                  {selectedCatalogContext ? (
                    <ul className="mt-4 space-y-2 text-sm text-slate-300">
                      <li>Generic: {selectedCatalogContext.pack.product.genericNameEn ?? "Not set"}</li>
                      <li>Category / form: {selectedCatalogContext.pack.product.categoryEn ?? "Unclassified"} · {selectedCatalogContext.pack.product.dosageForm?.nameEn ?? "No dosage form"}</li>
                      <li>Supplier: {selectedCatalogContext.pack.product.supplier?.nameEn ?? "No supplier linked"}</li>
                      <li>Barcode: {selectedCatalogContext.pack.packBarcode ?? selectedCatalogContext.pack.product.barcode ?? "Runtime not exposed"}</li>
                      <li>
                        Batch / expiry: {selectedCatalogContext.lot.batchNo} ·{" "}
                        {formatDateLabel(selectedCatalogContext.lot.expiryDate)}
                      </li>
                    </ul>
                  ) : focusedProductSnapshot ? (
                    <ul className="mt-4 space-y-2 text-sm text-slate-300">
                      <li>Strength / form: {focusedProductSnapshot.packCode}</li>
                      <li>Barcode: {focusedProductSnapshot.barcode}</li>
                      <li>
                        Batch / expiry: {focusedProductSnapshot.batch} ·{" "}
                        {focusedProductSnapshot.expiryLabel}
                      </li>
                    </ul>
                  ) : (
                    <ul className="mt-4 space-y-2 text-sm text-slate-400">
                      <li>Generic</li>
                      <li>Category / form</li>
                      <li>Strength / form</li>
                    </ul>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Honest only: runtime-backed where available, no fake supplier or compliance claims where the current model does not support them.
                  </p>
                </section>

                <section className={cn(mutedSurfaceClass, "p-4")}>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Pharmacist guidance
                    </p>
                    <h3 className="text-lg font-semibold text-slate-50">
                      Secondary, visible, and non-blocking.
                    </h3>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-slate-300">
                    {pharmacistAlerts.map((alert) => (
                      <li
                        key={alert.title}
                        className="rounded-[8px] border border-slate-700 bg-[#11161d] px-3 py-3"
                      >
                        <p className="font-semibold text-slate-100">
                          {alert.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          {alert.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>
          </section>
              {cartError ? (
                <Notice
                  title="Sale action blocked"
                  body={cartError}
                  tone="error"
                />
              ) : null}
          </>
        ) : workspaceView === "search" ? (
          <section className="rounded-[14px] border border-amber-900/50 bg-[#17140f] p-4 lg:p-5">
            <div className="flex flex-col gap-4 border-b border-slate-700/90 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Lookup bench / product search
                </p>
                <h2 className="text-2xl font-semibold text-slate-50">
                  Dedicated lookup bench for runtime-backed trade, generic, supplier, and category search.
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-400">
                  This workspace stays separate from the cashier while exposing richer lookup identity from the live runtime-backed product truth.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={secondaryButtonClass} type="button" onClick={() => setWorkspaceView("cashier")}>
                  Back to cashier
                </button>
                <button className={secondaryButtonClass} type="button" onClick={() => setWorkspaceView("maintenance")}>
                  Open pricing / entry
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
              <section className="space-y-4 rounded-[10px] border border-amber-900/50 bg-[#120f0b] p-4">
                <input className={inputClass} placeholder={searchMeta.placeholder} value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(searchModeMeta) as Array<[CatalogSearchMode, { label: string }]>).map(([mode, meta]) => (
                    <SearchModeButton key={mode} active={catalogSearchMode === mode} label={meta.label} onClick={() => setCatalogSearchMode(mode)} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchCategoryExamples.map((example) => (
                    <button key={example} type="button" onClick={() => { setCatalogSearchMode("category"); setCatalogSearch(example); }} className="rounded-[8px] border border-amber-900/50 bg-[#1a1610] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-amber-700/50 hover:bg-[#231c12] hover:text-slate-100">
                      {example}
                    </button>
                  ))}
                </div>
                <div className="rounded-[8px] border border-amber-900/50 bg-[#1a1610] px-4 py-3 text-sm leading-6 text-slate-400">
                  {searchMeta.note}
                </div>
                <Notice title="Lookup truth" body="Results come from live pack/lot runtime records that now carry trade, generic, category, dosage-form, supplier, and price cues where those fields exist in the current product truth." tone="info" />
              </section>
              <section className={cn(mutedSurfaceClass, "p-4")}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-700/90 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Runtime lookup results</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-50">{visibleCatalogOptions.length} pack / lot results</h3>
                  </div>
                  <button className={secondaryButtonClass} type="button" onClick={loadContextAndCatalog} disabled={!workspaceReady}>
                    Refresh lookup
                  </button>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {visibleSearchResults.length ? visibleSearchResults.map((option) => {
                    const isSelected = option.key === selectedCatalogKey;
                    return (
                      <button key={option.key} type="button" onClick={() => handleCatalogSelection(option.key)} className={cn("rounded-[8px] border-l-[3px] p-4 text-left transition", isSelected ? "border-amber-400/70 bg-[#221b12]" : "border-transparent bg-[#17130f] hover:bg-[#1e1810]")}> 
                        <p className="text-sm font-semibold text-slate-50">{option.label}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{option.subtitle}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{option.supporting}</p>
                      </button>
                    );
                  }) : (
                    <div className="xl:col-span-2">
                      <EmptyPanel title="No lookup results" body="The runtime does not have a matching pack / lot record for the current search. Adjust the search term, refresh the workspace, or create the product truth from the pricing desk." />
                    </div>
                  )}
                </div>
              </section>
              <aside className="rounded-[10px] border border-amber-900/50 bg-[#120f0b] p-4">
                {selectedCatalogContext ? (
                  <div className="space-y-3">
                    <p className="text-lg font-semibold text-slate-50">{selectedCatalogContext.pack.product.tradeNameEn ?? selectedCatalogContext.pack.product.nameEn}</p>
                    <p className="text-sm text-slate-400">{selectedCatalogContext.pack.product.genericNameEn ?? "Generic not set"} · {selectedCatalogContext.pack.product.categoryEn ?? selectedCatalogContext.pack.product.dosageForm?.nameEn ?? "Unclassified"}</p>
                    <CompactInfoCard label="Supplier" value={selectedCatalogContext.pack.product.supplier?.nameEn ?? "No supplier linked"} supporting={selectedCatalogContext.pack.product.supplier?.code ?? "Supplier truth is optional in this scope."} tone="sky" />
                    <CompactInfoCard label="Price" value={formatMoney(selectedCatalogContext.pack.product.defaultSalePrice ?? 0, "JOD")} supporting={`Tax readiness ${selectedCatalogContext.pack.product.taxProfileCode ?? "not set"}`} tone="emerald" />
                    <CompactInfoCard label="Barcode" value={selectedCatalogContext.pack.packBarcode ?? selectedCatalogContext.pack.product.barcode ?? "Runtime not exposed"} tone="sky" />
                    <CompactInfoCard label="Lot / expiry" value={`${selectedCatalogContext.lot.batchNo} · ${formatDateLabel(selectedCatalogContext.lot.expiryDate)}`} supporting={`${selectedCatalogContext.lot.sellableQuantity} sellable at this branch`} tone="amber" />
                    <div className="flex flex-wrap gap-2">
                      <button className={primaryButtonClass} type="button" onClick={() => setWorkspaceView("cashier")}>Use at counter</button>
                      <button className={secondaryButtonClass} type="button" onClick={() => setWorkspaceView("maintenance")}>Open pricing / entry</button>
                    </div>
                  </div>
                ) : (
                  <EmptyPanel title="No result selected" body="Choose a runtime result to preview it here, then send it back to the counter or into pricing / entry." />
                )}
              </aside>
            </div>
          </section>
        ) : workspaceView === "maintenance" ? (
          <section className="rounded-[14px] border border-sky-900/50 bg-[#121920] p-4 lg:p-5">
            <div className="flex flex-col gap-4 border-b border-slate-700/90 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Pricing desk / product entry / classification
                </p>
                <h2 className="text-2xl font-semibold text-slate-50">
                  Separate pricing desk for real maintenance, classification, and persistence work.
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-400">
                  This workspace saves through the current backend architecture and keeps the cashier screen focused on selling.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={secondaryButtonClass} type="button" onClick={() => setWorkspaceView("cashier")}>Back to cashier</button>
                <button className={secondaryButtonClass} type="button" onClick={() => setWorkspaceView("search")}>Open lookup</button>
                <button className={secondaryButtonClass} type="button" onClick={startNewMaintenanceRecord}>New product</button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section className={cn(mutedSurfaceClass, "space-y-4 p-4")}>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Runtime focus</p>
                  <h3 className="text-lg font-semibold text-slate-50">{selectedCatalogContext ? (selectedCatalogContext.pack.product.tradeNameEn ?? selectedCatalogContext.pack.product.nameEn) : "New maintenance record"}</h3>
                  <p className="text-sm leading-6 text-slate-400">
                    {selectedCatalogContext ? "The selected runtime product stays visible here while you edit fields, pricing, classification, and branch stock truth." : "Start a new product record here or open a runtime result first to edit an existing record."}
                  </p>
                </div>
                {selectedCatalogContext ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <CompactInfoCard label="Generic" value={selectedCatalogContext.pack.product.genericNameEn ?? "Not set"} supporting={selectedCatalogContext.pack.product.nameAr} tone="sky" />
                    <CompactInfoCard label="Class / form" value={selectedCatalogContext.pack.product.categoryEn ?? "Unclassified"} supporting={selectedCatalogContext.pack.product.dosageForm?.nameEn ?? "No dosage form"} tone="amber" />
                    <CompactInfoCard label="Pack / batch" value={selectedCatalogContext.pack.packCode} supporting={selectedCatalogContext.lot.batchNo} tone="emerald" />
                    <CompactInfoCard label="Sellable stock" value={`${selectedCatalogContext.lot.sellableQuantity}`} supporting={`Expiry ${formatDateLabel(selectedCatalogContext.lot.expiryDate)}`} tone="emerald" />
                  </div>
                ) : (
                  <EmptyPanel title="No runtime product selected" body="Use the lookup bench to open an existing product or start a new record directly from this desk." />
                )}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Classification examples</p>
                  <div className="flex flex-wrap gap-2">{maintenanceCategories.map((category) => (<button key={category} type="button" onClick={() => updateMaintenanceField("categoryEn", category)} className="rounded-[8px] border border-sky-900/40 bg-[#10151d] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-sky-700/50 hover:text-slate-100">{category}</button>))}</div>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dosage form examples</p>
                  <div className="flex flex-wrap gap-2">{dosageFormExamples.map((form) => (<button key={form} type="button" onClick={() => updateMaintenanceField("dosageFormName", form)} className="rounded-[8px] border border-sky-900/40 bg-[#10151d] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-sky-700/50 hover:text-slate-100">{form}</button>))}</div>
                </div>
                <Notice title="Persistence scope" body="Save now updates product truth, pack / lot anchors, and branch stock through the current architecture. Tax readiness remains a modeling field only; it does not claim live fiscal integration." tone="info" />
              </section>
              <section className={cn(mutedSurfaceClass, "space-y-4 p-4")}>
                {maintenanceError ? (
                  <Notice title="Maintenance save blocked" body={maintenanceError} tone="error" />
                ) : null}
                {maintenanceSuccess ? (
                  <Notice title="Maintenance save persisted" body={maintenanceSuccess} tone="success" />
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Trade / commercial name</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.tradeNameEn} onChange={(e) => updateMaintenanceField("tradeNameEn", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Generic name</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.genericNameEn} onChange={(e) => updateMaintenanceField("genericNameEn", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Category / classification</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.categoryEn} onChange={(e) => updateMaintenanceField("categoryEn", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dosage form</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.dosageFormName} onChange={(e) => updateMaintenanceField("dosageFormName", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Strength</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.strength} onChange={(e) => updateMaintenanceField("strength", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pack</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.packSize} onChange={(e) => updateMaintenanceField("packSize", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Barcode</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.barcode} onChange={(e) => updateMaintenanceField("barcode", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Supplier / company</p><select className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.supplierId} onChange={(e) => updateMaintenanceField("supplierId", e.target.value)}><option value="">No supplier linked</option>{suppliers.map((supplier) => (<option key={supplier.id} value={supplier.id}>{supplier.nameEn} · {supplier.code}</option>))}</select></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Before-tax price</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" type="number" min={0} step={0.01} value={maintenanceForm.defaultSalePrice} onChange={(e) => updateMaintenanceField("defaultSalePrice", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tax readiness code</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.taxProfileCode} onChange={(e) => updateMaintenanceField("taxProfileCode", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pack code</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.packCode} onChange={(e) => updateMaintenanceField("packCode", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pack barcode</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.packBarcode} onChange={(e) => updateMaintenanceField("packBarcode", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Batch number</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" value={maintenanceForm.batchNo} onChange={(e) => updateMaintenanceField("batchNo", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Expiry date</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" type="date" value={maintenanceForm.expiryDate} onChange={(e) => updateMaintenanceField("expiryDate", e.target.value)} /></label>
                  <label className={metricCardClass}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Branch sellable stock</p><input className="mt-1.5 h-10 w-full rounded-[6px] border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none" type="number" min={0} step={1} value={maintenanceForm.branchStockQuantity} onChange={(e) => updateMaintenanceField("branchStockQuantity", e.target.value)} /></label>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={maintenanceForm.isActive} onChange={(e) => updateMaintenanceField("isActive", e.target.checked)} /> Product is active for search and cashier use</label>
                <div className="flex flex-wrap gap-2">
                  <button className={primaryButtonClass} type="button" onClick={saveMaintenanceRecord}>Save product truth</button>
                  <button className={secondaryButtonClass} type="button" onClick={() => setWorkspaceView("search")}>Find it in lookup</button>
                  <button className={secondaryButtonClass} type="button" onClick={() => setWorkspaceView("cashier")}>Send to cashier</button>
                </div>
              </section>
            </div>
          </section>
        ) : (
          <section
          id="secondary-workspace"
          className="rounded-[14px] border border-rose-900/40 bg-[#191114] p-4 lg:p-5"
        >
          <div className="flex flex-col gap-4 border-b border-slate-700/90 pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Returns desk / transaction lookup
              </p>
              <h2 className="text-2xl font-semibold text-slate-50">
                Returns stay on their own desk with source-sale lookup and bounded refund execution.
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-400">
                Finalized-return proof remains intact here while the sell counter stays focused on live billing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={cn(
                  secondaryButtonClass,
                  secondaryPane === "lookup" &&
                    "border-emerald-400/60 bg-emerald-500/10 text-emerald-100",
                )}
                type="button"
                onClick={() => setSecondaryPane("lookup")}
              >
                Transaction lookup
              </button>
              <button
                className={cn(
                  secondaryButtonClass,
                  secondaryPane === "return" &&
                    "border-emerald-400/60 bg-emerald-500/10 text-emerald-100",
                )}
                type="button"
                onClick={() => setSecondaryPane("return")}
              >
                Return workflow
              </button>
            </div>
          </div>

          {secondaryPane === "lookup" ? (
            <div className="mt-4 space-y-4">
              {selectedSaleDetail ? (
                <div className="rounded-[8px] border border-sky-400/30 bg-sky-500/10 px-4 py-4 text-sky-100">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        Return source selected: {selectedSaleDetail.documentNo}
                      </p>
                      <p className="mt-1 text-sm text-sky-200">
                        The lookup list remains the selection surface. Switch to
                        the return tab only when you want to execute the bounded
                        refund flow.
                      </p>
                    </div>
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={() => setSecondaryPane("return")}
                    >
                      Open return workflow
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={cn(mutedSurfaceClass, "p-4")}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    className={inputClass}
                    placeholder="Search by fiscal reference, session reference, or payment mode"
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                  />
                  <div className="rounded-[8px] border border-slate-800 bg-[#11161d] px-4 py-3 text-sm text-slate-300">
                    {visibleFinalizedSales.length} transaction
                    {visibleFinalizedSales.length === 1 ? "" : "s"} in scope
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  Scoped to{" "}
                  <span className="font-semibold text-slate-200">
                    {activeBranch?.name ?? "current branch"}
                  </span>{" "}
                  and{" "}
                  <span className="font-semibold text-slate-200">
                    {activeRegister
                      ? `${activeRegister.code} · ${activeRegister.nameEn}`
                      : "current register"}
                  </span>
                  .
                </p>
              </div>

              {visibleFinalizedSales.length ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {visibleFinalizedSales.map((sale) => {
                    const payment = sale.paymentFinalizations?.[0] ?? null;
                    const isSelected = sale.id === selectedSaleId;
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => void loadSaleDetail(sale.id)}
                        className={cn(
                          "rounded-[8px] border-l-[3px] p-4 text-left transition",
                          isSelected
                            ? "border-rose-400/70 bg-[#241619]"
                            : "border-transparent bg-[#130e10] hover:bg-[#1a1215]",
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <ToneBadge tone={stateTone(sale.state)}>
                                {sale.state}
                              </ToneBadge>
                              {isSelected ? (
                                <ToneBadge tone="emerald">
                                  Selected for return
                                </ToneBadge>
                              ) : null}
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-slate-50">
                                {sale.documentNo}
                              </p>
                              <p className="mt-1 text-sm text-slate-400">
                                Session{" "}
                                {sale.posCartSession?.sessionNumber ?? "-"}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1 text-left lg:text-right">
                            <p className="text-sm font-semibold text-slate-50">
                              {formatMoney(sale.grandTotal, sale.currency)}
                            </p>
                            <p className="text-sm text-slate-400">
                              {formatDateTime(
                                payment?.finalizedAt ?? sale.finalizedAt,
                              )}
                            </p>
                            <p className="text-sm text-slate-400">
                              {payment?.paymentMethod ?? "Cash"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel
                  title="No finalized sales found"
                  body="Refresh recent sales or adjust the search term for the current branch/register scope."
                />
              )}

              {returnError ? (
                <Notice
                  title="Lookup action blocked"
                  body={returnError}
                  tone="error"
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {finalizedReturnSummary ? (
                <div className="rounded-[8px] border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ToneBadge tone="emerald">FINALIZED</ToneBadge>
                        <ToneBadge tone="emerald">Return completed</ToneBadge>
                      </div>
                      <h3 className="text-xl font-semibold text-emerald-100">
                        {finalizedReturnSummary.returnReference}
                      </h3>
                      <p className="text-sm text-emerald-200">
                        Source sale {finalizedReturnSummary.sourceSaleReference}{" "}
                        · Return session{" "}
                        {finalizedReturnSummary.returnSessionNumber}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[340px]">
                      <CompactInfoCard
                        label="Refund total"
                        value={formatMoney(
                          finalizedReturnSummary.amount,
                          finalizedReturnSummary.currency,
                        )}
                        tone="emerald"
                      />
                      <CompactInfoCard
                        label="Finalized at"
                        value={formatDateTime(
                          finalizedReturnSummary.finalizedAt,
                        )}
                        tone="emerald"
                      />
                      <CompactInfoCard
                        label="Source sale"
                        value={finalizedReturnSummary.sourceSaleReference}
                        supporting={
                          finalizedReturnSummary.sourceSessionReference ??
                          "Session unavailable"
                        }
                      />
                      <CompactInfoCard
                        label="Next safe action"
                        value="Lookup another sale"
                        supporting="This finalized return is locked and read only."
                      />
                    </div>
                  </div>
                  <div className="mt-3 rounded-[8px] border border-emerald-400/30 bg-[#10151d] px-4 py-3 text-sm leading-6 text-emerald-100">
                    Return finalized and locked. This completion surface remains
                    visible so the operator can prove the refund reference,
                    source-sale relationship, and next safe action at a glance.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={resetReturnWorkspace}
                    >
                      Create another return
                    </button>
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={() => setSecondaryPane("lookup")}
                    >
                      Back to lookup
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedSaleDetail ? (
                <div className={cn(mutedSurfaceClass, "p-4")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ToneBadge tone={stateTone(selectedSaleDetail.state)}>
                          {selectedSaleDetail.state}
                        </ToneBadge>
                        <ToneBadge tone="sky">Return source selected</ToneBadge>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-50">
                          {selectedSaleDetail.documentNo}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          Session{" "}
                          {selectedSaleDetail.posCartSession?.sessionNumber ??
                            "-"}{" "}
                          · {selectedSalePayment?.paymentMethod ?? "Cash"}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[320px]">
                      <CompactInfoCard
                        label="Sale total"
                        value={formatMoney(
                          selectedSaleDetail.grandTotal,
                          selectedSaleDetail.currency,
                        )}
                        tone="sky"
                      />
                      <CompactInfoCard
                        label="Finalized at"
                        value={formatDateTime(
                          selectedSalePayment?.finalizedAt ??
                            selectedSaleDetail.finalizedAt,
                        )}
                        tone="sky"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={primaryButtonClass}
                      type="button"
                      onClick={createReturnSession}
                      disabled={!selectedSaleDetail || !!returnSession}
                    >
                      {finalizedReturnSummary
                        ? "Return finalized"
                        : returnSession
                          ? "Return draft open"
                          : "Create return draft"}
                    </button>
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={resetReturnWorkspace}
                      disabled={!selectedSaleDetail && !returnSession}
                    >
                      Reset return flow
                    </button>
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={() => setSecondaryPane("lookup")}
                    >
                      Choose another source sale
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyPanel
                  title="No return source selected"
                  body="Choose a finalized sale from transaction lookup first. The return workflow stays honest and secondary until a real source sale exists."
                />
              )}

              {selectedSaleDetail ? (
                <div className={cn(mutedSurfaceClass, "p-4")}>
                  <div className="flex flex-col gap-2 border-b border-slate-700/90 pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Returnable lines
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-50">
                        Select the source line to return
                      </h3>
                    </div>
                    <p className="text-sm text-slate-400">
                      Remaining eligible quantity stays visible directly on each
                      line.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {safeSelectedSaleLines.map((line) => {
                      const isSelected = line.id === returnSourceLineId;
                      return (
                        <button
                          key={line.id}
                          type="button"
                          disabled={!isReturnMutable}
                          onClick={() => {
                            setReturnSourceLineId(line.id);
                            setReturnUnitPrice(line.unitPrice);
                          }}
                          className={cn(
                            "rounded-[8px] border-l-[3px] p-3 text-left transition",
                            isSelected
                              ? "border-rose-400/70 bg-[#241619]"
                              : "border-transparent bg-[#130e10] hover:bg-[#1a1215]",
                            !isReturnMutable && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <ToneBadge tone="slate">
                                  Line {line.lineNo}
                                </ToneBadge>
                                <ToneBadge tone="amber">
                                  Batch {line.lotBatch?.batchNo ?? "-"}
                                </ToneBadge>
                                {isSelected ? (
                                  <ToneBadge tone="emerald">
                                    Selected source line
                                  </ToneBadge>
                                ) : null}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-50">
                                  {line.productPack.product.nameEn}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {line.productPack.product.nameAr} · Returnable
                                  sale line
                                </p>
                              </div>
                            </div>
                            <div className="grid gap-1.5 sm:grid-cols-3 lg:min-w-[320px]">
                              <MetricPill label="Sold" value={line.quantity} />
                              <MetricPill
                                label="Returned"
                                value={line.alreadyReturnedQty}
                              />
                              <MetricPill
                                label="Remaining"
                                value={line.remainingQty}
                                tone="emerald"
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {selectedSaleDetail ? (
                <div className={cn(mutedSurfaceClass, "p-4")}>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Return entry
                    </p>
                    <h3 className="text-lg font-semibold text-slate-50">
                      Prepare and finalize the refund line
                    </h3>
                    <p className="text-sm text-slate-400">
                      This stays bound to the selected source line and becomes
                      read only once the return is finalized.
                    </p>
                  </div>

                  {selectedReturnSourceLine ? (
                    <div className="mt-3 rounded-[8px] border border-emerald-400/30 bg-[#10151d] px-4 py-3">
                      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                            Selected return source
                          </p>
                          <p className="mt-1.5 text-sm font-semibold text-slate-50">
                            {
                              selectedReturnSourceLine.productPack.product
                                .nameEn
                            }{" "}
                            · Batch{" "}
                            {selectedReturnSourceLine.lotBatch?.batchNo ?? "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Source sale {selectedSaleDetail.documentNo}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[280px]">
                          <MetricPill
                            label="Remaining eligible"
                            value={selectedReturnSourceLine.remainingQty}
                            tone="emerald"
                          />
                          <MetricPill
                            label="Refund unit"
                            value={formatMoney(
                              returnUnitPrice,
                              selectedSaleDetail.currency,
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[8px] border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-sky-100">
                      Select the source line first. This selected-source card
                      appears only once the return relationship is actually
                      bound.
                    </div>
                  )}

                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      step={1}
                      value={returnQuantity}
                      disabled={!isReturnMutable}
                      onChange={(e) =>
                        setReturnQuantity(Number(e.target.value) || 1)
                      }
                    />
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step={0.01}
                      value={returnUnitPrice}
                      disabled={!isReturnMutable}
                      onChange={(e) =>
                        setReturnUnitPrice(Number(e.target.value) || 0)
                      }
                    />
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={addReturnLine}
                      disabled={!isReturnMutable}
                    >
                      Add return line
                    </button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      className={accentButtonClass}
                      type="button"
                      onClick={finalizeReturn}
                      disabled={!isReturnMutable}
                    >
                      Finalize return
                    </button>
                    {returnFinalized ? (
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={resetReturnWorkspace}
                      >
                        Start another return
                      </button>
                    ) : null}
                  </div>

                  {returnFinalized ? (
                    <div className="mt-3 rounded-[8px] border border-emerald-400/30 bg-[#10151d] px-4 py-3 text-sm leading-6 text-emerald-100">
                      Return finalized and locked. Line selection, quantity
                      edits, and finalization controls are now read only by
                      design.
                    </div>
                  ) : returnSession ? (
                    <div className="mt-3 rounded-[8px] border border-slate-700 bg-[#10151d] px-4 py-3 text-sm leading-6 text-slate-300">
                      Return draft open. Add the allowed refund line, then
                      finalize once the refund amount is correct.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {returnSession ? (
                <div className={cn(mutedSurfaceClass, "p-4")}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Return totals
                  </p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                    <CompactInfoCard
                      label="Subtotal"
                      value={formatMoney(
                        returnSession.subtotal,
                        returnSession.currency,
                      )}
                    />
                    <CompactInfoCard
                      label="Discount"
                      value={formatMoney(
                        returnSession.discountTotal,
                        returnSession.currency,
                      )}
                    />
                    <CompactInfoCard
                      label="Tax"
                      value={formatMoney(
                        returnSession.taxTotal,
                        returnSession.currency,
                      )}
                    />
                    <CompactInfoCard
                      label="Refund total"
                      value={formatMoney(
                        returnSession.grandTotal,
                        returnSession.currency,
                      )}
                      tone="emerald"
                    />
                  </div>
                </div>
              ) : null}

              {returnError ? (
                <Notice
                  title="Return action blocked"
                  body={returnError}
                  tone="error"
                />
              ) : null}
            </div>
          )}
        </section>
        )}
      </div>
    </main>
  );
}























