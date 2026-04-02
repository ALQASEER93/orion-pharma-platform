"use client";

import type { ReactNode } from "react";
import { FormEvent, useMemo, useState } from "react";
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
  product: { nameEn: string; nameAr: string };
  lots: Array<{
    lotBatchId: string;
    batchNo: string;
    sellableQuantity: number;
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
      product: { nameEn: string; nameAr: string };
    };
    lotBatch?: { batchNo: string } | null;
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
type StatusTone = "emerald" | "amber" | "rose" | "slate" | "sky";
type OperatorActionState =
  | "setup"
  | "load-workspace"
  | "start-sale"
  | "resume-sale"
  | "return-mode";
type CatalogSearchMode = "trade" | "generic" | "supplier" | "category";

const defaultTenant = "11111111-1111-4111-8111-111111111111";
const defaultBranch = "22222222-2222-4222-8222-222222222222";
const surfaceClass =
  "rounded-[28px] border border-slate-200/80 bg-white/94 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur";
const mutedSurfaceClass =
  "rounded-[24px] border border-slate-200/85 bg-slate-50/92";
const inputClass =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(5,150,105,0.28)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
const accentButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none";
const metricCardClass =
  "rounded-[18px] border border-slate-200 bg-white px-3 py-2.5 shadow-sm";
const searchCategoryExamples = [
  "Tablets",
  "Syrup",
  "Suppositories",
  "Supplements",
  "Cosmetics",
];
const searchModeMeta: Record<
  CatalogSearchMode,
  { label: string; placeholder: string; note: string }
> = {
  trade: {
    label: "Trade name",
    placeholder: "Scan barcode or search by trade name, pack code, or batch",
    note: "Trade-name search is active against the current runtime payload.",
  },
  generic: {
    label: "Generic / active ingredient",
    placeholder: "Search by generic name or active ingredient shell",
    note: "Generic search uses the product naming fields exposed by the current runtime until richer catalog truth exists.",
  },
  supplier: {
    label: "Supplier / company",
    placeholder: "Search by supplier or company shell",
    note: "Supplier/company search affordance is honest UI shell only in this slice. The current POS runtime does not expose supplier indexing on this route.",
  },
  category: {
    label: "Category / form",
    placeholder: "Search by category or dosage form shell",
    note: "Category/form affordance is shown now so pharmacists have the right search mental model. Catalog metadata wiring is still pending.",
  },
};
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : tone === "sky"
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

function KeyValue({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "text-sm text-slate-700",
          emphasis && "text-base font-semibold text-slate-950",
        )}
      >
        {value}
      </p>
    </div>
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
      ? "border-emerald-200 bg-emerald-50/90"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/90"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50/90"
          : tone === "sky"
            ? "border-sky-200 bg-sky-50/90"
            : "border-slate-200 bg-white";

  return (
    <div
      className={cn("rounded-[18px] border px-3.5 py-3 shadow-sm", toneClass)}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
      {supporting ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">{supporting}</p>
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
      ? "bg-emerald-50 text-emerald-900"
      : tone === "amber"
        ? "bg-amber-50 text-amber-900"
        : tone === "rose"
          ? "bg-rose-50 text-rose-900"
          : tone === "sky"
            ? "bg-sky-50 text-sky-900"
            : "bg-slate-100 text-slate-800";

  return (
    <div className={cn("rounded-2xl px-3 py-2 text-sm", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-65">
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
      ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
      : tone === "error"
        ? "border-rose-200 bg-rose-50/90 text-rose-900"
        : "border-sky-200 bg-sky-50/90 text-sky-900";

  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-sm", toneClass)}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{body}</p>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
      <p className="text-base font-semibold text-slate-700">{title}</p>
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
        "rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.16em] transition",
        active
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
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
  const [email, setEmail] = useState("products-workspace@orion.local");
  const [password, setPassword] = useState("Admin@123");
  const [token, setToken] = useState("");

  const [context, setContext] = useState<PosContextResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogPack[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSearchMode, setCatalogSearchMode] =
    useState<CatalogSearchMode>("trade");
  const [openCarts, setOpenCarts] = useState<OpenCartSession[]>([]);

  const [cartSession, setCartSession] = useState<PosCartSession | null>(null);
  const [lineEdits, setLineEdits] = useState<Record<string, LineEditState>>({});
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
  const latestCartPayment = cartSession?.paymentFinalizations?.[0] ?? null;
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
  const workspaceLabel = activeRegister
    ? `${activeBranch?.name ?? "Branch"} · ${activeRegister.code} · ${activeRegister.nameEn}`
    : (activeBranch?.name ?? "Workspace not loaded");
  const runtimeLabel =
    context?.contextSource === "DEMO_SEED_OR_REAL_DB"
      ? "Demo-ready runtime"
      : context
        ? "Runtime database"
        : "Not loaded";
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
    return packs.flatMap((pack) =>
      (Array.isArray(pack.lots) ? pack.lots : [])
        .filter((lot) => {
          const search = catalogSearch.trim().toLowerCase();
          if (!search) return true;
          return [
            pack.product.nameEn,
            pack.product.nameAr,
            pack.packCode,
            lot.batchNo,
          ].some((value) => value.toLowerCase().includes(search));
        })
        .map((lot) => ({
          key: `${pack.packId}::${lot.lotBatchId}`,
          label: `${pack.product.nameEn} · Pack ${pack.packCode}`,
          subtitle: `Batch ${lot.batchNo} · ${lot.sellableQuantity} sellable`,
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
        return {
          ...line,
          productPack:
            line.productPack ??
            (fallbackPack
              ? { code: fallbackPack.packCode, product: fallbackPack.product }
              : undefined),
          lotBatch:
            line.lotBatch ??
            (fallbackLot ? { batchNo: fallbackLot.batchNo } : null),
          beforeTaxTotal,
          taxValue,
          unitAfterTax: line.unitPrice * (1 + taxRate / 100),
          lineTotal: beforeTaxTotal + taxValue,
        };
      }),
    [catalog, safeCartLines],
  );

  const focusedProductSnapshot = useMemo(() => {
    if (selectedCatalogContext) {
      return {
        title: selectedCatalogContext.pack.product.nameEn,
        subtitle: `${selectedCatalogContext.pack.product.nameAr} · Pack ${selectedCatalogContext.pack.packCode}`,
        batch: selectedCatalogContext.lot.batchNo,
      };
    }

    if (selectedReturnSourceLine) {
      return {
        title: selectedReturnSourceLine.productPack.product.nameEn,
        subtitle: `${selectedReturnSourceLine.productPack.product.nameAr} · Return source line`,
        batch: selectedReturnSourceLine.lotBatch?.batchNo ?? "-",
      };
    }

    if (safeCartLines[0]?.productPack) {
      return {
        title: safeCartLines[0].productPack.product.nameEn,
        subtitle: `${safeCartLines[0].productPack.product.nameAr} · Active sale line`,
        batch: safeCartLines[0].lotBatch?.batchNo ?? "-",
      };
    }

    return null;
  }, [safeCartLines, selectedCatalogContext, selectedReturnSourceLine]);

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

  function bindCart(session: PosCartSession) {
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
      scrollToSection("sale-workspace");
      return;
    }
    if (operatorActionState === "return-mode") {
      setSecondaryPane("return");
      scrollToSection("secondary-workspace");
      return;
    }
    void createCartSession();
  }

  function handleHeaderSecondaryAction() {
    if (!workspaceReady) {
      scrollToSection("utility-diagnostics");
      return;
    }
    setSecondaryPane("lookup");
    scrollToSection("secondary-workspace");
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
    : "Open secondary workflows";

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
      setCatalog(Array.isArray(packs) ? packs : []);

      const carts = await apiRequest<OpenCartSession[]>(
        `/pos/operational/cart-sessions?branchId=${encodeURIComponent(branchId)}&registerId=${encodeURIComponent(resolvedRegister)}`,
      );
      setOpenCarts(Array.isArray(carts) ? carts : []);

      const sales = await apiRequest<FinalizedSaleSummary[]>(
        `/pos/operational/finalized-sales?branchId=${encodeURIComponent(branchId)}&registerId=${encodeURIComponent(resolvedRegister)}&search=${encodeURIComponent(salesSearch)}`,
      );
      setFinalizedSales(Array.isArray(sales) ? sales : []);
      setStatusMessage("Workspace loaded from the accepted backend runtime.");
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
            notes: "Stage 8.31A sales counter shell",
          }),
        },
      );
      bindCart(created);
      setStatusMessage(`New sale started: ${created.sessionNumber}`);
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function openCartSession(cartSessionId: string) {
    setCartError(null);
    try {
      bindCart(
        await apiRequest<PosCartSession>(
          `/pos/operational/cart-sessions/${cartSessionId}`,
        ),
      );
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
      await openCartSession(cartSession.id);
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
      setStatusMessage("Return finalized.");
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  const searchMeta = searchModeMeta[catalogSearchMode];
  const pharmacistAlerts = [
    {
      title: "Non-blocking pharmacist guidance",
      body: focusedProductSnapshot
        ? `${focusedProductSnapshot.title} is in focus. Composition, indication, and interaction content are not exposed by the current runtime, so this lane remains guidance-only in Stage 8.31A.`
        : "This lane reserves visible space for future interaction, duplication, and safety prompts. Stage 8.31A only adds the bounded non-blocking shell.",
      tone: "sky" as const,
    },
    {
      title: "Batch-aware soft check",
      body: focusedProductSnapshot
        ? `Batch ${focusedProductSnapshot.batch} stays visible for operator verification without blocking the sale flow.`
        : "Lot and batch verification stays in the sale-line context once a product is selected.",
      tone: "amber" as const,
    },
  ];

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_22%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_48%,_#ecfeff_100%)] text-slate-950"
      style={{
        fontFamily: '"Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif',
      }}
    >
      <div className="mx-auto max-w-[1560px] space-y-4 px-4 py-4 lg:px-6 lg:py-5">
        <header className={cn(surfaceClass, "p-4 lg:p-5")}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <ToneBadge tone="emerald">Stage 8.31A</ToneBadge>
                <ToneBadge tone="slate">Sales counter shell</ToneBadge>
                <ToneBadge
                  tone={
                    workspaceReady
                      ? "emerald"
                      : operatorAuthenticated
                        ? "amber"
                        : "rose"
                  }
                >
                  {workspaceReady
                    ? "Counter ready"
                    : operatorAuthenticated
                      ? "Load workspace next"
                      : "Authentication required"}
                </ToneBadge>
                {returnFocusMode ? (
                  <ToneBadge tone="sky">Return proof preserved</ToneBadge>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight text-slate-950 lg:text-[1.65rem]">
                  Invoice-first pharmacy counter.
                </h1>
                <p className="max-w-4xl text-sm leading-6 text-slate-600">
                  Selling dominates the route now: scan/search lives next to the
                  invoice, line items read like bill rows, totals stay decisive,
                  and lookup/returns/utilities move into a secondary lane.
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

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <CompactInfoCard
              label="Operator"
              value={operatorAuthenticated ? "Authenticated" : "Needs sign-in"}
              supporting={
                operatorAuthenticated
                  ? "Session token loaded for this counter."
                  : "Diagnostics stay collapsed until needed."
              }
              tone={operatorAuthenticated ? "emerald" : "rose"}
            />
            <CompactInfoCard
              label="Counter"
              value={
                activeRegister
                  ? `${activeRegister.code} · ${activeRegister.nameEn}`
                  : "Register not loaded"
              }
              supporting={activeBranch?.name ?? "No branch loaded"}
              tone={workspaceReady ? "emerald" : "amber"}
            />
            <CompactInfoCard
              label="Active invoice"
              value={
                cartSession?.fiscalSaleDocument?.documentNo ??
                cartSession?.sessionNumber ??
                "No open invoice"
              }
              supporting={
                cartSession ? cartSession.state : "Start or resume a sale"
              }
              tone={cartSession ? stateTone(cartSession.state) : "slate"}
            />
            <CompactInfoCard
              label="Secondary workflow"
              value={
                selectedSaleDetail?.documentNo ??
                returnSession?.returnNumber ??
                "Lookup idle"
              }
              supporting={
                returnFocusMode
                  ? "Return work is available without taking over the page."
                  : "Lookup and returns stay compact until needed."
              }
              tone={returnFocusMode ? "sky" : "slate"}
            />
            <CompactInfoCard
              label="Runtime"
              value={runtimeLabel}
              supporting={workspaceLabel}
              tone={workspaceReady ? "emerald" : "amber"}
            />
          </div>

          <details
            id="utility-diagnostics"
            className="mt-3 rounded-[18px] border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm"
          >
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Utility setup and diagnostics
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <form
                className="space-y-3 rounded-[18px] border border-slate-200 bg-white p-4"
                onSubmit={login}
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-950">
                    Operator sign-in defaults
                  </h3>
                  <p className="text-sm text-slate-500">
                    Visible on demand so setup never competes with the selling
                    surface.
                  </p>
                </div>
                <input
                  className={inputClass}
                  placeholder="Tenant ID"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button className={primaryButtonClass} type="submit">
                  Sign in
                </button>
              </form>

              <div className="space-y-3 rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-950">
                    Advanced overrides
                  </h3>
                  <p className="text-sm text-slate-500">
                    Only for branch, register, or token troubleshooting.
                  </p>
                </div>
                <input
                  className={inputClass}
                  placeholder="Branch ID"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Register ID"
                  value={registerId}
                  onChange={(e) => setRegisterId(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Technical bearer token (advanced only)"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <p className="text-xs leading-5 text-slate-500">
                  Technical token access remains available for troubleshooting,
                  but the live token is now masked so diagnostics stay
                  secondary.
                </p>
              </div>
            </div>
          </details>

          <div className="mt-3 space-y-3">
            {contextError ? (
              <Notice title="Setup blocked" body={contextError} tone="error" />
            ) : null}
            {statusMessage ? (
              <Notice
                title="Latest operation"
                body={statusMessage}
                tone="success"
              />
            ) : null}
          </div>
        </header>

        <section id="sale-workspace" className={cn(surfaceClass, "p-4 lg:p-5")}>
          <div className="grid gap-4 xl:grid-cols-[1.58fr_0.8fr]">
            <div className="space-y-4">
              <section className="rounded-[30px] bg-slate-950 px-5 py-5 text-white shadow-[0_30px_70px_rgba(15,23,42,0.24)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
                      Active invoice
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-white">
                        {cartSession?.fiscalSaleDocument?.documentNo ??
                          cartSession?.sessionNumber ??
                          "No sale open"}
                      </h2>
                      {cartSession ? (
                        <ToneBadge tone={stateTone(cartSession.state)}>
                          {cartSession.state}
                        </ToneBadge>
                      ) : (
                        <ToneBadge tone="slate">Idle</ToneBadge>
                      )}
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                      The counter opens around the invoice, not around setup
                      cards. Scan or search near the bill, add lines, then
                      settle totals from the same surface.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Branch / register
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-white">
                        {activeRegister
                          ? `${activeBranch?.name ?? "Branch"} · ${activeRegister.code}`
                          : (activeBranch?.name ?? "Not loaded")}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Open carts
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-white">
                        {safeOpenCarts.length}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        Payable now
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-white">
                        {formatMoney(
                          cartSession?.grandTotal ?? 0,
                          cartSession?.currency ?? "JOD",
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToneBadge tone="emerald">Barcode-first entry</ToneBadge>
                      <ToneBadge tone="sky">{searchMeta.label}</ToneBadge>
                      {selectedCatalogContext ? (
                        <ToneBadge tone="amber">
                          Batch {selectedCatalogContext.lot.batchNo}
                        </ToneBadge>
                      ) : null}
                    </div>
                    <input
                      className="h-14 w-full rounded-[22px] border border-white/10 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/20"
                      placeholder={searchMeta.placeholder}
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      {(
                        Object.entries(searchModeMeta) as Array<
                          [CatalogSearchMode, { label: string }]
                        >
                      ).map(([mode, meta]) => (
                        <SearchModeButton
                          key={mode}
                          active={catalogSearchMode === mode}
                          label={meta.label}
                          onClick={() => setCatalogSearchMode(mode)}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchCategoryExamples.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setCatalogSearchMode("category")}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold tracking-[0.16em] text-slate-300 transition hover:border-white/20 hover:text-white"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs leading-5 text-slate-300">
                      {searchMeta.note}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Selected pack and lot
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Scanner-friendly entry stays tied to the invoice area
                          instead of living in a detached admin card.
                        </p>
                      </div>
                      <select
                        className={cn(
                          inputClass,
                          "border-white/10 bg-white/95",
                        )}
                        value={selectedCatalogKey}
                        onChange={(e) => setSelectedCatalogKey(e.target.value)}
                        disabled={!cartSession || !isCartMutable}
                      >
                        <option value="">Select product pack and lot</option>
                        {visibleCatalogOptions.map((option) => (
                          <option
                            key={option.key}
                            value={option.key}
                          >{`${option.label} · ${option.subtitle}`}</option>
                        ))}
                      </select>
                      <div className="grid gap-3 md:grid-cols-[0.7fr_0.9fr_auto]">
                        <input
                          className={cn(
                            inputClass,
                            "border-white/10 bg-white/95",
                          )}
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
                          className={cn(
                            inputClass,
                            "border-white/10 bg-white/95",
                          )}
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
                      <p className="text-xs leading-5 text-slate-400">
                        {visibleCatalogOptions.length} sellable pack/lot option
                        {visibleCatalogOptions.length === 1 ? "" : "s"} in
                        scope.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className={cn(mutedSurfaceClass, "p-4")}>
                <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
                      Soft pharmacist alerts lane
                    </p>
                    <h3 className="text-lg font-semibold text-slate-950">
                      Visible guidance without stopping the sale.
                    </h3>
                  </div>
                  <ToneBadge tone="sky">
                    UI scaffold only where backend truth is absent
                  </ToneBadge>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {pharmacistAlerts.map((alert) => (
                    <Notice
                      key={alert.title}
                      title={alert.title}
                      body={alert.body}
                      tone="info"
                    />
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
                      Invoice surface
                    </p>
                    <h3 className="text-2xl font-semibold text-slate-950">
                      {cartSession ? "Live bill rows" : "No active invoice yet"}
                    </h3>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600">
                      Rows now read like an invoice: product identity, batch,
                      quantity, before-tax unit price, tax impact, and line
                      total stay visible together.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={primaryButtonClass}
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

                {!cartSession ? (
                  <div className="px-4 py-10">
                    <EmptyPanel
                      title="No active sale yet"
                      body="Authenticate the operator, load the workspace, then start or resume a sale. The invoice rows and bill footer will appear here once the counter is active."
                    />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <div className="min-w-[960px]">
                        <div className="grid grid-cols-[0.55fr_2.35fr_1.1fr_0.7fr_1fr_0.7fr_1fr_1fr] gap-3 bg-slate-50 px-4 py-3">
                          <InvoiceHeaderCell>Line</InvoiceHeaderCell>
                          <InvoiceHeaderCell>Item</InvoiceHeaderCell>
                          <InvoiceHeaderCell>Lot / batch</InvoiceHeaderCell>
                          <InvoiceHeaderCell align="right">
                            Qty
                          </InvoiceHeaderCell>
                          <InvoiceHeaderCell align="right">
                            Before tax
                          </InvoiceHeaderCell>
                          <InvoiceHeaderCell align="right">
                            Tax
                          </InvoiceHeaderCell>
                          <InvoiceHeaderCell align="right">
                            After tax
                          </InvoiceHeaderCell>
                          <InvoiceHeaderCell align="right">
                            Line total
                          </InvoiceHeaderCell>
                        </div>

                        {invoiceRows.length ? (
                          invoiceRows.map((line) => {
                            const edit = lineEdits[line.id] ?? {
                              quantity: line.quantity,
                              unitPrice: line.unitPrice,
                              discount: line.discount,
                              taxRate: line.taxRate ?? 0,
                            };
                            return (
                              <div
                                key={line.id}
                                className="border-b border-slate-200 px-4 py-4 last:border-b-0"
                              >
                                <div className="grid grid-cols-[0.55fr_2.35fr_1.1fr_0.7fr_1fr_0.7fr_1fr_1fr] items-start gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">
                                      {line.lineNo}
                                    </p>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-950">
                                        {line.productPack?.product.nameEn ??
                                          "Product pack"}
                                      </p>
                                      {line.productPack?.code ? (
                                        <ToneBadge tone="sky">
                                          Pack {line.productPack.code}
                                        </ToneBadge>
                                      ) : null}
                                    </div>
                                    <p className="text-xs leading-5 text-slate-500">
                                      {line.productPack?.product.nameAr ??
                                        "منتج"}{" "}
                                      · Strength / dosage context is only shown
                                      when the current runtime exposes it.
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">
                                      {line.lotBatch?.batchNo ?? "-"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Batch visible at line level
                                    </p>
                                  </div>
                                  <div className="text-right text-sm font-semibold text-slate-950">
                                    {line.quantity}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-950">
                                      {formatMoney(
                                        line.unitPrice,
                                        cartSession.currency,
                                      )}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Line base{" "}
                                      {formatMoney(
                                        line.beforeTaxTotal,
                                        cartSession.currency,
                                      )}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-950">{`${line.taxRate ?? 0}%`}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatMoney(
                                        line.taxValue,
                                        cartSession.currency,
                                      )}
                                    </p>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-950">
                                      {formatMoney(
                                        line.unitAfterTax,
                                        cartSession.currency,
                                      )}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Per-unit after tax
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-950">
                                      {formatMoney(
                                        line.lineTotal,
                                        cartSession.currency,
                                      )}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Discount{" "}
                                      {formatMoney(
                                        line.discount,
                                        cartSession.currency,
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {isCartMutable ? (
                                  <div className="mt-3 grid gap-2 xl:grid-cols-[0.7fr_0.9fr_0.9fr_0.8fr_auto_auto]">
                                    <label className={metricCardClass}>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        Qty
                                      </p>
                                      <input
                                        className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        Before tax
                                      </p>
                                      <input
                                        className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        Discount
                                      </p>
                                      <input
                                        className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        Tax %
                                      </p>
                                      <input
                                        className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                                      className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                      type="button"
                                      onClick={() => removeCartLine(line.id)}
                                    >
                                      Remove line
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-4 py-8">
                            <EmptyPanel
                              title="No sale lines yet"
                              body="Scan or search the first product pack and lot to start building the invoice."
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50/90 px-4 py-4">
                      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                        <div className="space-y-3">
                          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Bill footer actions
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {isCartMutable
                                ? "Tender and finalize from the bottom of the invoice, where the operator expects the bill to close."
                                : "The invoice is finalized. Cash-entry controls are hidden so the footer reads like a closed bill, not a live form."}
                            </p>
                            {isCartMutable ? (
                              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                                <input
                                  className={inputClass}
                                  placeholder="Cash tendered (optional)"
                                  value={cashTendered}
                                  onChange={(e) =>
                                    setCashTendered(e.target.value)
                                  }
                                />
                                <button
                                  className={accentButtonClass}
                                  type="button"
                                  onClick={finalizeCashSale}
                                >
                                  Finalize cash sale
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
                                Finalized sales are visually locked here. The
                                footer now behaves like a closed bill with
                                decisive totals, not a generic action wall.
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                className={secondaryButtonClass}
                                type="button"
                                onClick={() =>
                                  cartSession &&
                                  void openCartSession(cartSession.id)
                                }
                                disabled={!cartSession}
                              >
                                Refresh sale state
                              </button>
                              <button
                                className={secondaryButtonClass}
                                type="button"
                                onClick={() => setSecondaryPane("lookup")}
                              >
                                Go to lookup
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[26px] bg-slate-950 px-5 py-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Bill totals
                          </p>
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                              <span>Subtotal / before tax</span>
                              <span className="font-semibold text-white">
                                {formatMoney(
                                  cartSession.subtotal,
                                  cartSession.currency,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                              <span>Discount</span>
                              <span className="font-semibold text-white">
                                {formatMoney(
                                  cartSession.discountTotal,
                                  cartSession.currency,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                              <span>Tax total</span>
                              <span className="font-semibold text-white">
                                {formatMoney(
                                  cartSession.taxTotal,
                                  cartSession.currency,
                                )}
                              </span>
                            </div>
                            <div className="border-t border-white/10 pt-3">
                              <div className="flex items-end justify-between gap-3">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                                    Payable / after tax
                                  </p>
                                  <p className="mt-1 text-sm text-slate-300">
                                    Visible at the invoice footer by design.
                                  </p>
                                </div>
                                <p className="text-2xl font-semibold text-white">
                                  {formatMoney(
                                    cartSession.grandTotal,
                                    cartSession.currency,
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>

              {cartError ? (
                <Notice
                  title="Sale action blocked"
                  body={cartError}
                  tone="error"
                />
              ) : null}
            </div>

            <aside className="space-y-4">
              <section className={cn(mutedSurfaceClass, "p-4")}>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Counter strip
                  </p>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Compact operator and shift context.
                  </h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <KeyValue label="Workspace" value={workspaceLabel} emphasis />
                  <KeyValue label="Runtime" value={runtimeLabel} emphasis />
                  <KeyValue
                    label="Authentication"
                    value={
                      operatorAuthenticated
                        ? "Operator authenticated"
                        : "Sign-in pending"
                    }
                  />
                  <KeyValue
                    label="Register"
                    value={
                      activeRegister
                        ? `${activeRegister.code} · ${activeRegister.nameAr}`
                        : "No register loaded"
                    }
                  />
                </div>
              </section>

              <section className={cn(mutedSurfaceClass, "p-4")}>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Resume / open sale
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    Open carts stay accessible, but they no longer compete with
                    the invoice face.
                  </p>
                </div>
                <div className="mt-3 space-y-3">
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
                      <option
                        key={item.id}
                        value={item.id}
                      >{`${item.sessionNumber} · ${formatMoney(item.grandTotal, "JOD")}`}</option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-slate-500">
                    {safeOpenCarts.length} open sale
                    {safeOpenCarts.length === 1 ? "" : "s"} in the current
                    branch/register scope.
                  </p>
                </div>
              </section>

              <section className={cn(mutedSurfaceClass, "p-4")}>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Drug quick info
                  </p>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Bounded adjacent knowledge slot.
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    This panel acknowledges where composition and use cues
                    belong without pretending the backend already exposes full
                    clinical content.
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {focusedProductSnapshot ? (
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-sm font-semibold text-slate-950">
                        {focusedProductSnapshot.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {focusedProductSnapshot.subtitle}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <CompactInfoCard
                          label="Composition / active ingredient"
                          value="Awaiting backend truth"
                          supporting="Stage 8.31A only reserves the quick-info surface."
                          tone="sky"
                        />
                        <CompactInfoCard
                          label="Use / indication"
                          value="Awaiting backend truth"
                          supporting={`Current visible batch: ${focusedProductSnapshot.batch}`}
                          tone="amber"
                        />
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel
                      title="No medicine in focus"
                      body="Once the operator highlights or adds a line, this quick-info slot will stay adjacent to the counter surface."
                    />
                  )}
                </div>
              </section>

              <section className={cn(mutedSurfaceClass, "p-4")}>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Finalized sale summary
                  </p>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Compact post-sale reference.
                  </h3>
                </div>
                {cartSession ? (
                  <div
                    className={cn(
                      "mt-4 rounded-[24px] p-4",
                      cartSession.state === "FINALIZED"
                        ? "border border-emerald-200 bg-emerald-50/90"
                        : "border border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Reference
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {cartSession.fiscalSaleDocument?.documentNo ??
                            cartSession.sessionNumber}
                        </p>
                      </div>
                      <ToneBadge tone={stateTone(cartSession.state)}>
                        {cartSession.state}
                      </ToneBadge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <KeyValue
                        label="Payment"
                        value={latestCartPayment?.paymentMethod ?? "Cash"}
                      />
                      <KeyValue
                        label="Payable"
                        value={formatMoney(
                          cartSession.grandTotal,
                          cartSession.currency,
                        )}
                      />
                      <KeyValue
                        label="Finalized at"
                        value={formatDateTime(
                          latestCartPayment?.finalizedAt ??
                            cartSession.fiscalSaleDocument?.finalizedAt,
                        )}
                      />
                      <KeyValue
                        label="Session"
                        value={cartSession.sessionNumber}
                      />
                    </div>
                    <div className="mt-3 rounded-[18px] border border-white/60 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-600">
                      {cartSession.state === "FINALIZED"
                        ? "This stays small by design. The invoice surface carries the operator, and this summary becomes a compact reference for lookup and returns."
                        : "The sale is still open. This card remains reference-only until finalization is complete."}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <EmptyPanel
                      title="No sale summary yet"
                      body="Complete a sale and the compact post-sale reference will settle here without overtaking the counter."
                    />
                  </div>
                )}
              </section>
            </aside>
          </div>
        </section>

        <section
          id="secondary-workspace"
          className={cn(surfaceClass, "p-4 lg:p-5")}
        >
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Secondary workflows
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">
                Lookup and bounded returns stay real, but secondary.
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                The accepted 8.30C-R1 return-success proof remains intact here.
                This lane is intentionally subordinate to the sales counter
                above.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={cn(
                  secondaryButtonClass,
                  secondaryPane === "lookup" &&
                    "border-emerald-300 bg-emerald-50 text-emerald-700",
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
                    "border-emerald-300 bg-emerald-50 text-emerald-700",
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
                <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4 text-sky-950 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        Return source selected: {selectedSaleDetail.documentNo}
                      </p>
                      <p className="mt-1 text-sm text-sky-900">
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
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    {visibleFinalizedSales.length} transaction
                    {visibleFinalizedSales.length === 1 ? "" : "s"} in scope
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Scoped to{" "}
                  <span className="font-semibold text-slate-700">
                    {activeBranch?.name ?? "current branch"}
                  </span>{" "}
                  and{" "}
                  <span className="font-semibold text-slate-700">
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
                          "rounded-[24px] border p-4 text-left shadow-sm transition",
                          isSelected
                            ? "border-emerald-300 bg-emerald-50 shadow-[0_18px_32px_rgba(16,185,129,0.12)]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
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
                              <p className="text-lg font-semibold text-slate-950">
                                {sale.documentNo}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Session{" "}
                                {sale.posCartSession?.sessionNumber ?? "-"}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1 text-left lg:text-right">
                            <p className="text-sm font-semibold text-slate-950">
                              {formatMoney(sale.grandTotal, sale.currency)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formatDateTime(
                                payment?.finalizedAt ?? sale.finalizedAt,
                              )}
                            </p>
                            <p className="text-sm text-slate-500">
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
                <div className="rounded-[26px] border border-emerald-200 bg-emerald-50/95 p-4 shadow-[0_20px_40px_rgba(16,185,129,0.12)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ToneBadge tone="emerald">FINALIZED</ToneBadge>
                        <ToneBadge tone="emerald">Return completed</ToneBadge>
                      </div>
                      <h3 className="text-xl font-semibold text-emerald-950">
                        {finalizedReturnSummary.returnReference}
                      </h3>
                      <p className="text-sm text-emerald-900">
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
                  <div className="mt-3 rounded-[18px] border border-emerald-200 bg-white/85 px-4 py-3 text-sm leading-6 text-emerald-950">
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
                        <h3 className="text-xl font-semibold text-slate-950">
                          {selectedSaleDetail.documentNo}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
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
                  <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Returnable lines
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">
                        Select the source line to return
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500">
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
                            "rounded-[20px] border p-3 text-left transition",
                            isSelected
                              ? "border-emerald-300 bg-emerald-50 shadow-[0_16px_30px_rgba(16,185,129,0.12)]"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
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
                                <p className="text-sm font-semibold text-slate-950">
                                  {line.productPack.product.nameEn}
                                </p>
                                <p className="text-xs text-slate-500">
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
                    <h3 className="text-lg font-semibold text-slate-950">
                      Prepare and finalize the refund line
                    </h3>
                    <p className="text-sm text-slate-600">
                      This stays bound to the selected source line and becomes
                      read only once the return is finalized.
                    </p>
                  </div>

                  {selectedReturnSourceLine ? (
                    <div className="mt-3 rounded-[18px] border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                            Selected return source
                          </p>
                          <p className="mt-1.5 text-sm font-semibold text-slate-950">
                            {
                              selectedReturnSourceLine.productPack.product
                                .nameEn
                            }{" "}
                            · Batch{" "}
                            {selectedReturnSourceLine.lotBatch?.batchNo ?? "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
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
                    <div className="mt-3 rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
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
                    <div className="mt-3 rounded-[18px] border border-emerald-200 bg-white px-4 py-3 text-sm leading-6 text-emerald-900">
                      Return finalized and locked. Line selection, quantity
                      edits, and finalization controls are now read only by
                      design.
                    </div>
                  ) : returnSession ? (
                    <div className="mt-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
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
      </div>
    </main>
  );
}
