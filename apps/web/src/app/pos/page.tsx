'use client';

import type { ReactNode } from 'react';
import { FormEvent, useMemo, useState } from 'react';
import { getApiBase } from '../../lib/api-base';

type PosContextResponse = {
  tenantId: string;
  contextSource: 'DEMO_SEED_OR_REAL_DB' | 'REAL_DB_RUNTIME';
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
  state: 'OPEN' | 'PAYMENT_PENDING' | 'FINALIZED' | 'CANCELLED';
  branchId: string;
  registerId: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  fiscalSaleDocumentId: string | null;
  fiscalSaleDocument?: { documentNo: string; state: string; grandTotal: number; finalizedAt?: string | null } | null;
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
  state: 'OPEN' | 'FINALIZED' | 'CANCELLED';
  fiscalReturnDocumentId: string | null;
  fiscalReturnDocument?: { documentNo: string } | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
};

type OpenCartSession = {
  id: string;
  sessionNumber: string;
  state: string;
  grandTotal: number;
};

type LineEditState = { quantity: number; unitPrice: number; discount: number; taxRate: number };
type StatusTone = 'emerald' | 'amber' | 'rose' | 'slate' | 'sky';

const defaultTenant = '11111111-1111-4111-8111-111111111111';
const defaultBranch = '22222222-2222-4222-8222-222222222222';
const surfaceClass = 'rounded-[24px] border border-slate-200/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.07)] backdrop-blur';
const mutedSurfaceClass = 'rounded-[20px] border border-slate-200/90 bg-slate-50/88';
const inputClass =
  'h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';
const textareaClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(5,150,105,0.28)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none';
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400';
const accentButtonClass =
  'inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none';

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function parseApiError(payload: unknown, status: number) {
  if (!payload || typeof payload !== 'object') return `Request failed (${status}).`;
  const data = payload as { message?: unknown; error?: unknown };
  if (typeof data.message === 'string') return data.message;
  if (Array.isArray(data.message)) return data.message.join(' | ');
  if (data.message && typeof data.message === 'object') {
    const nested = data.message as { message?: string; details?: unknown };
    if (nested.message && Array.isArray(nested.details)) {
      return `${nested.message}: ${nested.details.map((x) => JSON.stringify(x)).join(' | ')}`;
    }
    if (nested.message) return nested.message;
  }
  if (typeof data.error === 'string') return data.error;
  return `Request failed (${status}).`;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-JO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function stateTone(state?: string | null): StatusTone {
  switch (state) {
    case 'FINALIZED':
    case 'ACCEPTED':
      return 'emerald';
    case 'OPEN':
    case 'PAYMENT_PENDING':
      return 'sky';
    case 'CANCELLED':
    case 'REJECTED':
      return 'rose';
    default:
      return 'slate';
  }
}

function ToneBadge({ children, tone }: { children: ReactNode; tone: StatusTone }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : tone === 'sky'
            ? 'border-sky-200 bg-sky-50 text-sky-700'
            : 'border-slate-200 bg-slate-100 text-slate-700';

  return <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide', toneClass)}>{children}</span>;
}

function KeyValue({ label, value, emphasis = false }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={cn('text-sm text-slate-700', emphasis && 'text-base font-semibold text-slate-950')}>{value}</p>
    </div>
  );
}

function Notice({ title, body, tone }: { title: string; body: string; tone: 'success' | 'error' | 'info' }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
      : tone === 'error'
        ? 'border-rose-200 bg-rose-50/90 text-rose-900'
        : 'border-sky-200 bg-sky-50/90 text-sky-900';

  return (
    <div className={cn('rounded-2xl border px-4 py-3 shadow-sm', toneClass)}>
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

export default function PosPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [branchId, setBranchId] = useState(defaultBranch);
  const [registerId, setRegisterId] = useState('');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [email, setEmail] = useState('products-workspace@orion.local');
  const [password, setPassword] = useState('Admin@123');
  const [token, setToken] = useState('');

  const [context, setContext] = useState<PosContextResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogPack[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [openCarts, setOpenCarts] = useState<OpenCartSession[]>([]);

  const [cartSession, setCartSession] = useState<PosCartSession | null>(null);
  const [lineEdits, setLineEdits] = useState<Record<string, LineEditState>>({});
  const [selectedCatalogKey, setSelectedCatalogKey] = useState('');
  const [newLineQty, setNewLineQty] = useState(1);
  const [newLinePrice, setNewLinePrice] = useState(0);
  const [cashTendered, setCashTendered] = useState('');

  const [salesSearch, setSalesSearch] = useState('');
  const [finalizedSales, setFinalizedSales] = useState<FinalizedSaleSummary[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<FinalizedSaleDetail | null>(null);
  const [returnSession, setReturnSession] = useState<PosReturnSession | null>(null);
  const [returnSourceLineId, setReturnSourceLineId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnUnitPrice, setReturnUnitPrice] = useState(0);

  const [contextError, setContextError] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isCartMutable = !!cartSession && (cartSession.state === 'OPEN' || cartSession.state === 'PAYMENT_PENDING');
  const safeOpenCarts = Array.isArray(openCarts) ? openCarts : [];
  const safeCartLines = Array.isArray(cartSession?.lines) ? cartSession.lines : [];
  const safeSelectedSaleLines = Array.isArray(selectedSaleDetail?.lines) ? selectedSaleDetail.lines : [];
  const activeBranch = context?.branches.find((item) => item.id === branchId) ?? null;
  const activeRegister = context?.registers.find((item) => item.id === registerId) ?? null;
  const isReturnMutable = !!returnSession && returnSession.state === 'OPEN';
  const latestCartPayment = cartSession?.paymentFinalizations?.[0] ?? null;
  const selectedSalePayment = selectedSaleDetail?.paymentFinalizations?.[0] ?? null;
  const selectedReturnSourceLine = safeSelectedSaleLines.find((line) => line.id === returnSourceLineId) ?? null;
  const workspaceReady = Boolean(token && context && registerId);

  const visibleCatalogOptions = useMemo(() => {
    const packs = Array.isArray(catalog) ? catalog : [];
    return packs.flatMap((pack) =>
      (Array.isArray(pack.lots) ? pack.lots : [])
        .filter((lot) => {
          const search = catalogSearch.trim().toLowerCase();
          if (!search) return true;
          return [pack.product.nameEn, pack.product.nameAr, pack.packCode, lot.batchNo].some((value) =>
            value.toLowerCase().includes(search),
          );
        })
        .map((lot) => ({
          key: `${pack.packId}::${lot.lotBatchId}`,
          label: `${pack.product.nameEn} | ${pack.packCode} | Batch ${lot.batchNo}`,
          subtitle: `${lot.sellableQuantity} sellable`,
        })),
    );
  }, [catalogSearch, catalog]);

  const visibleFinalizedSales = useMemo(() => {
    const sales = Array.isArray(finalizedSales) ? finalizedSales : [];
    const search = salesSearch.trim().toLowerCase();
    if (!search) return sales;
    return sales.filter((sale) => {
      const sessionNumber = sale.posCartSession?.sessionNumber ?? '';
      const paymentMethod = sale.paymentFinalizations?.[0]?.paymentMethod ?? '';
      return [sale.documentNo, sessionNumber, paymentMethod, sale.state].some((value) => value.toLowerCase().includes(search));
    });
  }, [salesSearch, finalizedSales]);

  async function apiRequest<T>(path: string, init?: RequestInit, skipAuth = false): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    headers.set('Content-Type', 'application/json');
    headers.set('x-tenant-id', tenantId);
    if (!skipAuth) {
      if (!token) throw new Error('Bearer token is required.');
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new Error(parseApiError(await response.json().catch(() => null), response.status));
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

  async function performLogin() {
    setContextError(null);
    try {
      const payload = await apiRequest<{ access_token: string }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, tenantId }),
        },
        true,
      );
      setToken(payload.access_token);
      setStatusMessage('Operator session authenticated successfully.');
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
        '';
      setRegisterId(resolvedRegister);
      setLegalEntityId(ctx.registers.find((item) => item.id === resolvedRegister)?.legalEntityId ?? '');

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

      setStatusMessage('Workspace loaded from the accepted backend runtime.');
    } catch (error) {
      setContextError((error as Error).message);
    }
  }

  async function createCartSession() {
    setCartError(null);
    if (!registerId) {
      setCartError('Register is required before creating cart session.');
      return;
    }

    try {
      const created = await apiRequest<PosCartSession>('/pos/operational/cart-sessions', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          registerId,
          legalEntityId: legalEntityId || undefined,
          currency: 'JOD',
          notes: 'Stage 8.30B operator UI polish flow',
        }),
      });
      bindCart(created);
      setStatusMessage(`New sale started: ${created.sessionNumber}`);
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function openCartSession(cartSessionId: string) {
    setCartError(null);
    try {
      bindCart(await apiRequest<PosCartSession>(`/pos/operational/cart-sessions/${cartSessionId}`));
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function addCartLine() {
    setCartError(null);
    if (!cartSession) {
      setCartError('Start or open a sale first.');
      return;
    }
    if (!isCartMutable) {
      setCartError('Finalized sale is immutable.');
      return;
    }

    const [packId, lotBatchId] = selectedCatalogKey.split('::');
    if (!packId || !lotBatchId) {
      setCartError('Select product pack + lot first.');
      return;
    }

    try {
      await apiRequest(`/pos/operational/cart-sessions/${cartSession.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productPackId: packId, lotBatchId, quantity: newLineQty, unitPrice: newLinePrice, discount: 0, taxRate: 0 }),
      });
      await openCartSession(cartSession.id);
      setStatusMessage('Sale line added.');
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
        await apiRequest<PosCartSession>(`/pos/operational/cart-sessions/${cartSession.id}/lines/${lineId}`, {
          method: 'PATCH',
          body: JSON.stringify(edit),
        }),
      );
      setStatusMessage('Sale line updated.');
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function removeCartLine(lineId: string) {
    if (!cartSession) return;
    setCartError(null);
    try {
      bindCart(
        await apiRequest<PosCartSession>(`/pos/operational/cart-sessions/${cartSession.id}/lines/${lineId}`, {
          method: 'DELETE',
        }),
      );
      setStatusMessage('Sale line removed.');
    } catch (error) {
      setCartError((error as Error).message);
    }
  }

  async function finalizeCashSale() {
    if (!cartSession) return;
    setCartError(null);
    const amountApplied = Number(cartSession.grandTotal.toFixed(2));
    const amountTendered = cashTendered ? Number(Number(cashTendered).toFixed(2)) : amountApplied;
    try {
      await apiRequest(`/pos/operational/cart-sessions/${cartSession.id}/finalize-cash`, {
        method: 'POST',
        body: JSON.stringify({ amountApplied, amountTendered }),
      });
      bindCart(await apiRequest<PosCartSession>(`/pos/operational/cart-sessions/${cartSession.id}`));
      await refreshFinalizedSales();
      setStatusMessage('Cash sale finalized.');
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
    try {
      setSelectedSaleDetail(await apiRequest<FinalizedSaleDetail | null>(`/pos/operational/finalized-sales/${saleId}`));
      setReturnSourceLineId('');
      setReturnQuantity(1);
      setReturnUnitPrice(0);
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function createReturnSession() {
    if (!selectedSaleDetail) {
      setReturnError('Load a finalized sale first.');
      return;
    }
    if (!registerId) {
      setReturnError('Register is required.');
      return;
    }
    if (!['FINALIZED', 'ACCEPTED'].includes(selectedSaleDetail.state)) {
      setReturnError('Only finalized sales can start returns.');
      return;
    }

    setReturnError(null);
    try {
      setReturnSession(
        await apiRequest<PosReturnSession>('/pos/operational/return-sessions', {
          method: 'POST',
          body: JSON.stringify({
            branchId,
            registerId,
            legalEntityId: legalEntityId || undefined,
            sourceSaleDocumentId: selectedSaleDetail.id,
            reasonCode: 'POS_RETURN',
            currency: selectedSaleDetail.currency,
          }),
        }),
      );
      setStatusMessage('Return draft created against the selected sale.');
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function addReturnLine() {
    if (!selectedSaleDetail || !returnSession) {
      setReturnError('Create a return draft and select a source line first.');
      return;
    }
    if (returnSession.state !== 'OPEN') {
      setReturnError('Return session is not mutable.');
      return;
    }

    const source = safeSelectedSaleLines.find((line) => line.id === returnSourceLineId);
    if (!source || !source.lotBatchId) {
      setReturnError('Select a valid source sale line.');
      return;
    }

    setReturnError(null);
    try {
      await apiRequest(`/pos/operational/return-sessions/${returnSession.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          sourceSaleLineId: source.id,
          productPackId: source.productPackId,
          lotBatchId: source.lotBatchId,
          quantityReturned: returnQuantity,
          unitPrice: returnUnitPrice,
          discount: source.discount,
          taxRate: source.taxRate ?? 0,
          reasonCode: 'POS_RETURN_LINE',
        }),
      });
      setReturnSession(await apiRequest<PosReturnSession>(`/pos/operational/return-sessions/${returnSession.id}`));
      setStatusMessage('Return line added.');
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function finalizeReturn() {
    if (!returnSession) return;
    setReturnError(null);
    try {
      await apiRequest(`/pos/operational/return-sessions/${returnSession.id}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ refundAmount: Number(returnSession.grandTotal.toFixed(2)) }),
      });
      setReturnSession(await apiRequest<PosReturnSession>(`/pos/operational/return-sessions/${returnSession.id}`));
      if (selectedSaleDetail) await loadSaleDetail(selectedSaleDetail.id);
      setStatusMessage('Return finalized.');
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_25%),linear-gradient(180deg,_#f8fafc_0%,_#eff6ff_52%,_#ecfeff_100%)] text-slate-950"
      style={{ fontFamily: '"Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif' }}
    >
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 lg:px-6 lg:py-6">
        <header className={cn(surfaceClass, 'overflow-hidden p-4 lg:p-5')}>
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr] xl:items-start">
            <div className="space-y-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone="emerald">Stage 8.30B</ToneBadge>
                  <ToneBadge tone="slate">POS UI polish</ToneBadge>
                  <ToneBadge tone={workspaceReady ? 'emerald' : 'amber'}>{workspaceReady ? 'Workspace ready' : 'Setup required'}</ToneBadge>
                </div>
                <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 lg:text-[2.2rem]">
                  Pharmacy POS for calm selling, fast lookup, and clearer returns.
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 lg:text-[15px]">
                  This polish pass keeps the accepted POS flow intact and tightens the screen around the operator&apos;s real scan path: open a sale,
                  finish it cleanly, find it later, and process a bounded return without wading through setup chrome.
                </p>
              </div>

              <div className={cn(mutedSurfaceClass, 'px-4 py-3')}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Operator flow</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700">1. Authenticate</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700">2. Start or resume sale</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700">3. Finalize, lookup, return</span>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[290px]">
                    <button className={primaryButtonClass} type="button" onClick={() => void performLogin()}>
                      Authenticate operator
                    </button>
                    <button className={secondaryButtonClass} type="button" onClick={loadContextAndCatalog} disabled={!token}>
                      Load workspace
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <aside className={cn(mutedSurfaceClass, 'p-4')}>
              <div className="flex flex-col gap-4 lg:flex-row xl:flex-col">
                <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Branch</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{activeBranch?.name ?? 'Load workspace'}</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Register</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{activeRegister ? `${activeRegister.code} · ${activeRegister.nameEn}` : 'Load workspace'}</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Runtime</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{context?.contextSource === 'DEMO_SEED_OR_REAL_DB' ? 'Demo-ready runtime' : context ? 'Runtime database' : 'Not loaded'}</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Session</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{token ? 'Authenticated' : 'Needs sign-in'}</p>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {contextError ? <Notice title="Setup blocked" body={contextError} tone="error" /> : null}
                  {statusMessage ? <Notice title="Latest operation" body={statusMessage} tone="success" /> : null}
                </div>
              </div>
            </aside>
          </div>

          <details className="mt-4 rounded-[18px] border border-slate-200/80 bg-white/75 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
              Utility setup and diagnostics / إعداد تقني وتشخيصي
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <form className="space-y-3 rounded-[18px] border border-slate-200 bg-white p-4" onSubmit={login}>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-950">Operator sign-in defaults</h3>
                  <p className="text-sm text-slate-500">Keep seeded credentials available without letting them compete with the selling flow.</p>
                </div>
                <input className={inputClass} placeholder="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
                <input className={inputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className={inputClass} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className={primaryButtonClass} type="submit">Sign in</button>
              </form>

              <div className="space-y-3 rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-950">Advanced overrides</h3>
                  <p className="text-sm text-slate-500">Only for branch/register troubleshooting or temporary token override.</p>
                </div>
                <input className={inputClass} placeholder="Branch ID" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
                <input className={inputClass} placeholder="Register ID" value={registerId} onChange={(e) => setRegisterId(e.target.value)} />
                <textarea className={textareaClass} rows={4} placeholder="Technical bearer token (advanced only)" value={token} onChange={(e) => setToken(e.target.value)} />
                <p className="text-xs leading-5 text-slate-500">Raw technical values remain available here for diagnostics, but they stay collapsed and secondary by default.</p>
              </div>
            </div>
          </details>
        </header>

        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
          <section className={cn(surfaceClass, 'p-4 lg:p-5')}>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Sale workspace</p>
                <h2 className="text-2xl font-semibold text-slate-950">Start and manage the active sale</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  The sale workspace is the primary action surface. It keeps new-sale creation, product entry, cart review, totals, and cash finalization in one calm flow.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
                <button className={primaryButtonClass} type="button" onClick={createCartSession} disabled={!workspaceReady}>
                  Start new sale
                </button>
                <button className={secondaryButtonClass} type="button" onClick={loadContextAndCatalog} disabled={!workspaceReady}>
                  Refresh workspace data
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className={cn(mutedSurfaceClass, 'p-4')}>
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone={workspaceReady ? 'emerald' : 'amber'}>{workspaceReady ? 'Ready to sell' : 'Authenticate and load context'}</ToneBadge>
                  {cartSession ? <ToneBadge tone={stateTone(cartSession.state)}>{cartSession.state}</ToneBadge> : null}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <KeyValue label="Branch" value={activeBranch?.name ?? 'Not loaded'} emphasis />
                  <KeyValue label="Register" value={activeRegister ? `${activeRegister.code} · ${activeRegister.nameEn}` : 'Not loaded'} emphasis />
                  <KeyValue label="Current sale" value={cartSession?.sessionNumber ?? 'No active sale'} emphasis />
                  <KeyValue label="Open carts" value={safeOpenCarts.length} emphasis />
                </div>
              </div>

              <div className={cn(mutedSurfaceClass, 'p-4')}>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Resume sale</p>
                    <p className="mt-2 text-sm text-slate-600">Pick an open sale already scoped to the active branch and register.</p>
                  </div>
                  <select className={inputClass} value="" onChange={(e) => e.target.value && void openCartSession(e.target.value)} disabled={!workspaceReady || !safeOpenCarts.length}>
                    <option value="">Select an open sale</option>
                    {safeOpenCarts.map((item) => (
                      <option key={item.id} value={item.id}>{`${item.sessionNumber} · ${formatMoney(item.grandTotal, 'JOD')}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {!cartSession ? (
                <EmptyPanel
                  title="No active sale yet"
                  body="Authenticate the operator, load the workspace, then start a new sale or resume an existing open sale. The sale composer will appear here once a cart session is active."
                />
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
                    <div className={cn(mutedSurfaceClass, 'p-4')}>
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Product entry</p>
                        <h3 className="text-lg font-semibold text-slate-950">Add product pack and lot</h3>
                        <p className="text-sm leading-6 text-slate-600">
                          Search stockable product packs by product name, pack code, or batch. Once the sale is finalized, the composer switches to a calm read-only state.
                        </p>
                      </div>

                      {isCartMutable ? (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr]">
                            <input className={inputClass} placeholder="Search product, pack, or batch" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
                            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{visibleCatalogOptions.length} available sellable options</p>
                          </div>
                          <select className={inputClass} value={selectedCatalogKey} onChange={(e) => setSelectedCatalogKey(e.target.value)}>
                            <option value="">Select product pack and lot</option>
                            {visibleCatalogOptions.map((option) => (
                              <option key={option.key} value={option.key}>{`${option.label} · ${option.subtitle}`}</option>
                            ))}
                          </select>
                          <div className="grid gap-3 md:grid-cols-[0.45fr_0.45fr_auto]">
                            <input className={inputClass} min={1} step={1} type="number" value={newLineQty} onChange={(e) => setNewLineQty(Number(e.target.value) || 1)} />
                            <input className={inputClass} min={0} step={0.01} type="number" value={newLinePrice} onChange={(e) => setNewLinePrice(Number(e.target.value) || 0)} />
                            <button className={primaryButtonClass} type="button" onClick={addCartLine}>Add line</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                          This sale is finalized and locked. Product entry controls are intentionally hidden from the active workflow so the page no longer reads like an editable debug form after completion.
                        </div>
                      )}
                    </div>

                    <div className={cn(mutedSurfaceClass, 'p-4')}>
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current sale snapshot</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-950">{cartSession.sessionNumber}</h3>
                          <ToneBadge tone={stateTone(cartSession.state)}>{cartSession.state}</ToneBadge>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <KeyValue label="Branch" value={activeBranch?.name ?? cartSession.branchId} />
                        <KeyValue label="Register" value={activeRegister ? `${activeRegister.code} · ${activeRegister.nameEn}` : cartSession.registerId} />
                        <KeyValue label="Fiscal reference" value={cartSession.fiscalSaleDocument?.documentNo ?? 'Pending finalization'} />
                        <KeyValue label="Payment mode" value={latestCartPayment?.paymentMethod ?? 'Cash sale'} />
                      </div>
                      <div className="mt-4 rounded-[20px] bg-slate-950 px-4 py-4 text-white">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Grand total</p>
                        <p className="mt-2 text-3xl font-semibold">{formatMoney(cartSession.grandTotal, cartSession.currency)}</p>
                        <p className="mt-2 text-sm text-slate-300">{cartSession.state === 'FINALIZED' ? 'This sale is now locked and ready for lookup/return scenarios.' : 'Finalize when the customer sale is complete.'}</p>
                      </div>
                    </div>
                  </div>

                  <div className={cn(mutedSurfaceClass, 'overflow-hidden')}>
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cart lines</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">{isCartMutable ? 'Edit the active sale before finalization' : 'Finalized sale lines'}</h3>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{safeCartLines.length} line{safeCartLines.length === 1 ? '' : 's'}</span>
                    </div>

                    {safeCartLines.length ? (
                      <div className="space-y-3 px-4 py-4">
                        {safeCartLines.map((line) => {
                          const edit = lineEdits[line.id] ?? { quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount, taxRate: line.taxRate ?? 0 };
                          return (
                            <div key={line.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <ToneBadge tone="slate">Line {line.lineNo}</ToneBadge>
                                    <ToneBadge tone="sky">Pack {line.productPack?.code ?? line.productPackId.slice(0, 8)}</ToneBadge>
                                    <ToneBadge tone="amber">Batch {line.lotBatch?.batchNo ?? line.lotBatchId.slice(0, 8)}</ToneBadge>
                                  </div>
                                  <div>
                                    <p className="text-base font-semibold text-slate-950">{line.productPack?.product.nameEn ?? 'Product pack'}</p>
                                    <p className="text-sm text-slate-500">{line.productPack?.product.nameAr ?? 'منتج'} · Lot-controlled inventory line</p>
                                  </div>
                                </div>
                                {isCartMutable ? (
                                  <div className="grid gap-3 md:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
                                    <label className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Qty</p>
                                      <input className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" type="number" min={1} step={1} value={edit.quantity} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, quantity: Number(e.target.value) || 1 } }))} />
                                    </label>
                                    <label className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Unit</p>
                                      <input className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" type="number" min={0} step={0.01} value={edit.unitPrice} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, unitPrice: Number(e.target.value) || 0 } }))} />
                                    </label>
                                    <label className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Discount</p>
                                      <input className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" type="number" min={0} step={0.01} value={edit.discount} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, discount: Number(e.target.value) || 0 } }))} />
                                    </label>
                                    <label className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tax %</p>
                                      <input className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" type="number" min={0} step={0.01} value={edit.taxRate} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, taxRate: Number(e.target.value) || 0 } }))} />
                                    </label>
                                  </div>
                                ) : (
                                  <div className="grid gap-3 md:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
                                    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Qty</p><p className="mt-2 text-base font-semibold text-slate-950">{line.quantity}</p></div>
                                    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Unit</p><p className="mt-2 text-base font-semibold text-slate-950">{formatMoney(line.unitPrice, cartSession.currency)}</p></div>
                                    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Discount</p><p className="mt-2 text-base font-semibold text-slate-950">{formatMoney(line.discount, cartSession.currency)}</p></div>
                                    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tax</p><p className="mt-2 text-base font-semibold text-slate-950">{line.taxRate ?? 0}%</p></div>
                                  </div>
                                )}
                              </div>
                              {isCartMutable ? (
                                <div className="mt-4 flex flex-wrap gap-3">
                                  <button className={secondaryButtonClass} type="button" onClick={() => updateCartLine(line.id)}>Update line</button>
                                  <button className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100" type="button" onClick={() => removeCartLine(line.id)}>Remove line</button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-6">
                        <EmptyPanel title="No sale lines yet" body="Add the first product pack and lot to start building this sale." />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.95fr_0.55fr]">
                    <div className={cn(mutedSurfaceClass, 'p-4')}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Totals</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm"><p className="text-xs text-slate-500">Subtotal</p><p className="mt-2 text-lg font-semibold text-slate-950">{formatMoney(cartSession.subtotal, cartSession.currency)}</p></div>
                        <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm"><p className="text-xs text-slate-500">Discount</p><p className="mt-2 text-lg font-semibold text-slate-950">{formatMoney(cartSession.discountTotal, cartSession.currency)}</p></div>
                        <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm"><p className="text-xs text-slate-500">Tax</p><p className="mt-2 text-lg font-semibold text-slate-950">{formatMoney(cartSession.taxTotal, cartSession.currency)}</p></div>
                        <div className="rounded-[18px] bg-slate-950 px-4 py-4 text-white shadow-sm"><p className="text-xs text-slate-400">Grand total</p><p className="mt-2 text-lg font-semibold">{formatMoney(cartSession.grandTotal, cartSession.currency)}</p></div>
                      </div>
                    </div>

                    <div className={cn(mutedSurfaceClass, 'p-4')}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cash finalization</p>
                      <div className="mt-4 space-y-3">
                        {isCartMutable ? (
                          <>
                            <input className={inputClass} placeholder="Cash tendered (optional)" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} />
                            <button className={accentButtonClass} type="button" onClick={finalizeCashSale}>Finalize cash sale</button>
                          </>
                        ) : (
                          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-900">
                            Finalized sales are visually locked here. Finalize controls no longer compete with the read-only summary once the transaction is complete.
                          </div>
                        )}
                        <button className={secondaryButtonClass} type="button" onClick={() => cartSession && void openCartSession(cartSession.id)} disabled={!cartSession}>Refresh sale state</button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {cartError ? <div className="mt-4"><Notice title="Sale action blocked" body={cartError} tone="error" /></div> : null}
          </section>

          <aside className="space-y-4">
            <section className={cn(surfaceClass, 'p-4 lg:p-5')}>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Finalized sale summary</p>
                <h2 className="text-2xl font-semibold text-slate-950">Calm post-sale confirmation</h2>
                <p className="text-sm leading-6 text-slate-600">After finalization, the operator sees a compact summary card instead of an editable form wall.</p>
              </div>

              {cartSession ? (
                <div className={cn('mt-4 rounded-[26px] p-5', cartSession.state === 'FINALIZED' ? 'border border-emerald-200 bg-emerald-50/90' : 'border border-slate-200 bg-slate-50/90')}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sale state</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-slate-950">{cartSession.fiscalSaleDocument?.documentNo ?? cartSession.sessionNumber}</h3>
                        <ToneBadge tone={stateTone(cartSession.state)}>{cartSession.state}</ToneBadge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Amount</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(cartSession.grandTotal, cartSession.currency)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <KeyValue label="Fiscal reference" value={cartSession.fiscalSaleDocument?.documentNo ?? 'Pending'} />
                    <KeyValue label="Session reference" value={cartSession.sessionNumber} />
                    <KeyValue label="Payment mode" value={latestCartPayment?.paymentMethod ?? 'Cash'} />
                    <KeyValue label="Payment reference" value={latestCartPayment?.referenceCode ?? 'Cash finalization'} />
                    <KeyValue label="Finalized at" value={formatDateTime(latestCartPayment?.finalizedAt ?? cartSession.fiscalSaleDocument?.finalizedAt)} />
                    <KeyValue label="Workspace" value={activeRegister ? `${activeBranch?.name ?? 'Branch'} · ${activeRegister.code}` : activeBranch?.name ?? 'Current branch'} />
                  </div>
                  <div className="mt-4 rounded-[20px] bg-white px-4 py-4 text-sm text-slate-600 shadow-sm">
                    {cartSession.state === 'FINALIZED'
                      ? 'This summary is now the primary reference for lookup and returns. Internal IDs are intentionally kept out of the main operator flow.'
                      : 'The sale is still open. Finalization details will settle here once the cash sale is completed.'}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyPanel title="No sale summary yet" body="Complete a sale and the compact post-sale summary will appear here with fiscal, payment, and session references." />
                </div>
              )}
            </section>
            <section className={cn(mutedSurfaceClass, 'p-4')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Context snapshot</p>
                  <h2 className="mt-2 text-base font-semibold text-slate-900">Secondary workspace context</h2>
                </div>
                <ToneBadge tone="slate">Utility only</ToneBadge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Branch and register</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{activeBranch?.name ?? 'Branch not loaded'}</p>
                  <p className="mt-1 text-sm text-slate-500">{activeRegister ? `${activeRegister.code} · ${activeRegister.nameEn}` : 'Register not loaded'}</p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Runtime source</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{context?.contextSource === 'DEMO_SEED_OR_REAL_DB' ? 'Demo-ready runtime data' : context ? 'Runtime DB data' : 'Not loaded'}</p>
                  <p className="mt-1 text-sm text-slate-500">{context?.registers.length ? `${context.registers.length} register(s) in scope` : 'Load workspace to verify context.'}</p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <section className={cn(surfaceClass, 'p-4 lg:p-5')}>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Transaction lookup</p>
                <h2 className="text-2xl font-semibold text-slate-950">Find finalized sales quickly</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  Search recent finalized sales using operator-facing references first. Fiscal document number and session reference stay prominent; raw internal identifiers stay out of the primary scan path.
                </p>
              </div>
              <button className={secondaryButtonClass} type="button" onClick={refreshFinalizedSales} disabled={!workspaceReady}>Refresh recent sales</button>
            </div>

            <div className="mt-4 space-y-4">
              <div className={cn(mutedSurfaceClass, 'p-4')}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input className={inputClass} placeholder="Search by fiscal reference, session reference, or payment mode" value={salesSearch} onChange={(e) => setSalesSearch(e.target.value)} />
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{visibleFinalizedSales.length} transaction{visibleFinalizedSales.length === 1 ? '' : 's'} in scope</div>
                </div>
                <p className="mt-3 text-sm text-slate-500">Scoped to <span className="font-semibold text-slate-700">{activeBranch?.name ?? 'current branch'}</span> and <span className="font-semibold text-slate-700">{activeRegister ? `${activeRegister.code} · ${activeRegister.nameEn}` : 'current register'}</span>.</p>
              </div>

              {visibleFinalizedSales.length ? (
                <div className="space-y-3">
                  {visibleFinalizedSales.map((sale) => {
                    const payment = sale.paymentFinalizations?.[0] ?? null;
                    const isSelected = sale.id === selectedSaleId;
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => void loadSaleDetail(sale.id)}
                        className={cn(
                          'w-full rounded-[24px] border p-4 text-left shadow-sm transition',
                          isSelected ? 'border-emerald-300 bg-emerald-50 shadow-[0_18px_32px_rgba(16,185,129,0.12)]' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <ToneBadge tone={stateTone(sale.state)}>{sale.state}</ToneBadge>
                              {isSelected ? <ToneBadge tone="emerald">Selected for return</ToneBadge> : null}
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-slate-950">{sale.documentNo}</p>
                              <p className="mt-1 text-sm text-slate-500">Session {sale.posCartSession?.sessionNumber ?? '-'}</p>
                            </div>
                          </div>
                          <div className="space-y-1 text-left lg:text-right">
                            <p className="text-sm font-semibold text-slate-950">{formatMoney(sale.grandTotal, sale.currency)}</p>
                            <p className="text-sm text-slate-500">{formatDateTime(payment?.finalizedAt ?? sale.finalizedAt)}</p>
                            <p className="text-sm text-slate-500">{payment?.paymentMethod ?? 'Cash'}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel title="No finalized sales found" body="Refresh recent sales or adjust the search term for the current branch/register scope." />
              )}
            </div>
          </section>

          <section className={cn(surfaceClass, 'p-4 lg:p-5')}>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Return workspace</p>
                <h2 className="text-2xl font-semibold text-slate-950">Create a bounded return against the selected sale</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  Select a finalized source sale, inspect the returnable lines, and create a controlled cash refund without blurring the lookup results and return actions together.
                </p>
              </div>
              <button className={primaryButtonClass} type="button" onClick={createReturnSession} disabled={!selectedSaleDetail}>Create return draft</button>
            </div>

            <div className="mt-4 space-y-4">
              {selectedSaleDetail ? (
                <div className={cn(mutedSurfaceClass, 'p-4')}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ToneBadge tone={stateTone(selectedSaleDetail.state)}>{selectedSaleDetail.state}</ToneBadge>
                        <ToneBadge tone="sky">Return source selected</ToneBadge>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-slate-950">{selectedSaleDetail.documentNo}</h3>
                      <p className="mt-1 text-sm text-slate-500">Session {selectedSaleDetail.posCartSession?.sessionNumber ?? '-'}</p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-sm font-semibold text-slate-950">{formatMoney(selectedSaleDetail.grandTotal, selectedSaleDetail.currency)}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedSalePayment?.paymentMethod ?? 'Cash'} · {formatDateTime(selectedSalePayment?.finalizedAt ?? selectedSaleDetail.finalizedAt)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyPanel title="No return source selected" body="Choose a finalized sale from the transaction lookup column and it will appear here as the return source." />
              )}

              {returnSession ? (
                <div className={cn('rounded-[24px] border p-4', returnSession.state === 'FINALIZED' ? 'border-emerald-200 bg-emerald-50/90' : 'border-slate-200 bg-slate-50/90')}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ToneBadge tone={stateTone(returnSession.state)}>{returnSession.state}</ToneBadge>
                        <h3 className="text-lg font-semibold text-slate-950">{returnSession.returnNumber}</h3>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Return fiscal reference {returnSession.fiscalReturnDocument?.documentNo ?? returnSession.fiscalReturnDocumentId ?? 'Pending'}</p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-sm text-slate-500">Refund total</p>
                      <p className="text-xl font-semibold text-slate-950">{formatMoney(returnSession.grandTotal, returnSession.currency)}</p>
                    </div>
                  </div>
                  {!isReturnMutable ? (
                    <div className="mt-4 rounded-[18px] border border-emerald-200 bg-white px-4 py-3 text-sm leading-6 text-emerald-900">
                      Return draft is finalized and locked. Return-entry controls are intentionally reduced so the final state reads clearly.
                    </div>
                  ) : null}
                </div>
              ) : null}
              {selectedSaleDetail ? (
                <div className={cn(mutedSurfaceClass, 'p-4')}>
                  <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Returnable lines</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">Choose the source line to return</h3>
                    </div>
                    <p className="text-sm text-slate-500">Remaining eligible quantity is surfaced directly on each line.</p>
                  </div>
                  <div className="mt-4 grid gap-3">
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
                            'rounded-[22px] border p-4 text-left transition',
                            isSelected ? 'border-emerald-300 bg-emerald-50 shadow-[0_16px_30px_rgba(16,185,129,0.12)]' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                            !isReturnMutable && 'cursor-not-allowed opacity-60',
                          )}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <ToneBadge tone="slate">Line {line.lineNo}</ToneBadge>
                                <ToneBadge tone="amber">Batch {line.lotBatch?.batchNo ?? '-'}</ToneBadge>
                              </div>
                              <p className="mt-3 text-base font-semibold text-slate-950">{line.productPack.product.nameEn}</p>
                              <p className="mt-1 text-sm text-slate-500">{line.productPack.product.nameAr} · Returnable sale line</p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[320px]">
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Sold <span className="ml-2 font-semibold text-slate-950">{line.quantity}</span></div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Returned <span className="ml-2 font-semibold text-slate-950">{line.alreadyReturnedQty}</span></div>
                              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Remaining <span className="ml-2 font-semibold">{line.remainingQty}</span></div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className={cn(mutedSurfaceClass, 'p-4')}>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Return entry</p>
                  <h3 className="text-lg font-semibold text-slate-950">Prepare the refund line</h3>
                  <p className="text-sm text-slate-600">The selected source line stays visible above; this area only handles allowed quantity and refund value.</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input className={inputClass} type="number" min={1} step={1} value={returnQuantity} disabled={!isReturnMutable} onChange={(e) => setReturnQuantity(Number(e.target.value) || 1)} />
                  <input className={inputClass} type="number" min={0} step={0.01} value={returnUnitPrice} disabled={!isReturnMutable} onChange={(e) => setReturnUnitPrice(Number(e.target.value) || 0)} />
                  <button className={secondaryButtonClass} type="button" onClick={addReturnLine} disabled={!isReturnMutable}>Add return line</button>
                </div>

                {selectedReturnSourceLine ? (
                  <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-sm">
                    <p className="font-semibold text-slate-950">Selected source line</p>
                    <p className="mt-2">{selectedReturnSourceLine.productPack.product.nameEn} · Batch {selectedReturnSourceLine.lotBatch?.batchNo ?? '-'}</p>
                    <p className="mt-1">Remaining eligible quantity: <span className="font-semibold text-emerald-700">{selectedReturnSourceLine.remainingQty}</span></p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button className={accentButtonClass} type="button" onClick={finalizeReturn} disabled={!isReturnMutable}>Finalize return</button>
                </div>
              </div>

              {returnSession ? (
                <div className={cn(mutedSurfaceClass, 'p-4')}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Return totals</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm"><p className="text-xs text-slate-500">Subtotal</p><p className="mt-2 text-lg font-semibold text-slate-950">{formatMoney(returnSession.subtotal, returnSession.currency)}</p></div>
                    <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm"><p className="text-xs text-slate-500">Discount</p><p className="mt-2 text-lg font-semibold text-slate-950">{formatMoney(returnSession.discountTotal, returnSession.currency)}</p></div>
                    <div className="rounded-[18px] bg-white px-4 py-4 shadow-sm"><p className="text-xs text-slate-500">Tax</p><p className="mt-2 text-lg font-semibold text-slate-950">{formatMoney(returnSession.taxTotal, returnSession.currency)}</p></div>
                    <div className="rounded-[18px] bg-slate-950 px-4 py-4 text-white shadow-sm"><p className="text-xs text-slate-400">Refund total</p><p className="mt-2 text-lg font-semibold">{formatMoney(returnSession.grandTotal, returnSession.currency)}</p></div>
                  </div>
                </div>
              ) : null}

              {returnError ? <Notice title="Return action blocked" body={returnError} tone="error" /> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}


