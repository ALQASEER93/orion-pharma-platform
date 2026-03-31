
'use client';

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

const defaultTenant = '11111111-1111-4111-8111-111111111111';
const defaultBranch = '22222222-2222-4222-8222-222222222222';

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
  return `${value.toFixed(2)} ${currency}`;
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
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const safeOpenCarts = Array.isArray(openCarts) ? openCarts : [];
  const safeFinalizedSales = Array.isArray(finalizedSales) ? finalizedSales : [];
  const safeCartLines = Array.isArray(cartSession?.lines) ? cartSession.lines : [];
  const safeSelectedSaleLines = Array.isArray(selectedSaleDetail?.lines) ? selectedSaleDetail.lines : [];
  const activeBranch = context?.branches.find((item) => item.id === branchId) ?? null;
  const activeRegister = context?.registers.find((item) => item.id === registerId) ?? null;
  const isReturnMutable = !!returnSession && returnSession.state === 'OPEN';
  const disabledControlClass = 'disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50';
  const latestCartPayment = cartSession?.paymentFinalizations?.[0] ?? null;
  const selectedSalePayment = selectedSaleDetail?.paymentFinalizations?.[0] ?? null;

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
  async function login(event: FormEvent) {
    event.preventDefault();
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
      setStatusMessage('Authenticated successfully.');
    } catch (error) {
      setContextError((error as Error).message);
    }
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

      setStatusMessage('Operational context loaded from backend.');
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
          notes: 'Stage 8.30 POS transaction lookup and return usability flow',
        }),
      });
      bindCart(created);
      setStatusMessage(`Cart created: ${created.sessionNumber}`);
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
      setCartError('Open/create cart first.');
      return;
    }
    if (!isCartMutable) {
      setCartError('Finalized cart is immutable.');
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
      setStatusMessage('Cart line added.');
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
      setStatusMessage('Cart line updated.');
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
      setStatusMessage('Cart line removed.');
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
    } catch (error) {
      setReturnError((error as Error).message);
    }
  }

  async function addReturnLine() {
    if (!selectedSaleDetail || !returnSession) {
      setReturnError('Create return session and pick a source line first.');
      return;
    }
    if (returnSession.state !== 'OPEN') {
      setReturnError('Return session is not mutable.');
      return;
    }

    const source = safeSelectedSaleLines.find((line) => line.id === returnSourceLineId);
    if (!source || !source.lotBatchId) {
      setReturnError('Select valid source sale line.');
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
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-7xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">POS Transaction Lookup / واجهة نقطة البيع</h1>
        <p className="text-sm text-slate-300">Stage 8.30 operator usability slice over the accepted backend POS operational core.</p>

        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4" onSubmit={login}>
            <h2 className="text-lg font-semibold">Authentication</h2>
            <input className="w-full rounded border border-slate-700 bg-slate-950 p-2" placeholder="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
            <input className="w-full rounded border border-slate-700 bg-slate-950 p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full rounded border border-slate-700 bg-slate-950 p-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="w-full rounded bg-cyan-700 px-3 py-2 text-sm font-medium" type="submit">Login / تسجيل الدخول</button>
            <textarea className="h-14 w-full rounded border border-slate-700 bg-slate-950 p-2 text-[10px] text-slate-400" placeholder="Technical bearer token (advanced)" value={token} onChange={(e) => setToken(e.target.value)} />
            <p className="text-[11px] text-slate-400">Technical auth token for diagnostics only.</p>
          </form>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-lg font-semibold">Operational Context</h2>
            <input className="w-full rounded border border-slate-700 bg-slate-950 p-2" placeholder="Branch ID" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
            <input className="w-full rounded border border-slate-700 bg-slate-950 p-2" placeholder="Register ID" value={registerId} onChange={(e) => setRegisterId(e.target.value)} />
            <button className="w-full rounded bg-emerald-700 px-3 py-2 text-sm font-medium" type="button" onClick={loadContextAndCatalog}>Load Context + Catalog</button>
            {context ? (
              <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm">
                <p>Context source: <span className="font-semibold text-emerald-300">{context.contextSource}</span></p>
                <p>Branches loaded: {context.branches.length}</p>
                <p>Registers loaded: {context.registers.length}</p>
                <p>Active branch: <span className="font-semibold text-cyan-300">{activeBranch?.name ?? branchId}</span></p>
                <p>Active register: <span className="font-semibold text-cyan-300">{activeRegister ? `${activeRegister.code} - ${activeRegister.nameEn}` : registerId || 'Not selected'}</span></p>
                <p>{context.contextSource === 'DEMO_SEED_OR_REAL_DB' ? 'Demo tenant identifier (real DB data, not mock).' : 'Runtime tenant context from real DB.'}</p>
              </div>
            ) : null}
          </div>
        </div>
        {contextError ? <p className="text-sm text-rose-300">{contextError}</p> : null}
        {statusMessage ? <p className="text-sm text-emerald-300">{statusMessage}</p> : null}

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-lg font-semibold">Cart / السلة</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <button className="rounded bg-indigo-700 px-3 py-2 text-sm" type="button" onClick={createCartSession}>Create New Cart Session</button>
            <select className="rounded border border-slate-700 bg-slate-950 p-2 text-sm" value="" onChange={(e) => e.target.value && void openCartSession(e.target.value)}>
              <option value="">Open existing OPEN cart...</option>
              {safeOpenCarts.map((item) => <option key={item.id} value={item.id}>{item.sessionNumber} ({item.state})</option>)}
            </select>
            <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Catalog search" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
          </div>

          {cartSession ? (
            <div className="grid gap-3 lg:grid-cols-[1.15fr,0.85fr]">
              <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm">
                <h3 className="text-sm font-semibold text-cyan-200">Current cart / الجلسة الحالية</h3>
                <div className="mt-2 space-y-1">
                  <p>Session reference: <span className="font-semibold">{cartSession.sessionNumber}</span></p>
                  <p>State: <span className="font-semibold">{cartSession.state}</span></p>
                  <p>Branch: <span className="font-semibold">{activeBranch?.name ?? cartSession.branchId}</span></p>
                  <p>Register: <span className="font-semibold">{activeRegister ? `${activeRegister.code} - ${activeRegister.nameEn}` : cartSession.registerId}</span></p>
                  <p>Fiscal sale reference: <span className="font-semibold">{cartSession.fiscalSaleDocument?.documentNo ?? '-'}</span></p>
                </div>
              </div>

              <div className={`rounded border p-3 text-sm ${cartSession.state === 'FINALIZED' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                <h3 className={`text-sm font-semibold ${cartSession.state === 'FINALIZED' ? 'text-emerald-200' : 'text-slate-200'}`}>
                  {cartSession.state === 'FINALIZED' ? 'Finalized sale summary / ملخص البيع النهائي' : 'Open cart summary / ملخص السلة المفتوحة'}
                </h3>
                <div className="mt-2 space-y-1">
                  <p>Fiscal reference: <span className="font-semibold">{cartSession.fiscalSaleDocument?.documentNo ?? '-'}</span></p>
                  <p>Session reference: <span className="font-semibold">{cartSession.sessionNumber}</span></p>
                  <p>Payment mode: <span className="font-semibold">{latestCartPayment?.paymentMethod ?? '-'}</span></p>
                  <p>Payment reference: <span className="font-semibold">{latestCartPayment?.referenceCode ?? 'Cash finalization'}</span></p>
                  <p>Finalized at: <span className="font-semibold">{formatDateTime(latestCartPayment?.finalizedAt)}</span></p>
                  <p className="font-semibold">Grand total: {formatMoney(cartSession.grandTotal, cartSession.currency)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {cartSession && !isCartMutable ? <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-200">Cart is locked because state is {cartSession.state}. Add/Update/Remove/Finalize controls are disabled, and this sale is now read-only in the UI.</p> : null}

          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded border border-slate-700 bg-slate-950 p-2 text-sm md:col-span-2" value={selectedCatalogKey} onChange={(e) => setSelectedCatalogKey(e.target.value)} disabled={!cartSession || !isCartMutable}>
              <option value="">Select ProductPack/Lot</option>
              {safeCatalog.flatMap((pack) => (Array.isArray(pack.lots) ? pack.lots : []).map((lot) => <option key={`${pack.packId}::${lot.lotBatchId}`} value={`${pack.packId}::${lot.lotBatchId}`}>{pack.product.nameEn} | {pack.packCode} | Batch {lot.batchNo} | Sellable {lot.sellableQuantity}</option>))}
            </select>
            <input className="rounded border border-slate-700 bg-slate-950 p-2" min={1} step={1} type="number" value={newLineQty} onChange={(e) => setNewLineQty(Number(e.target.value) || 1)} disabled={!cartSession || !isCartMutable} />
            <input className="rounded border border-slate-700 bg-slate-950 p-2" min={0} step={0.01} type="number" value={newLinePrice} onChange={(e) => setNewLinePrice(Number(e.target.value) || 0)} disabled={!cartSession || !isCartMutable} />
          </div>

          <button className={`rounded bg-cyan-700 px-3 py-2 text-sm ${disabledControlClass}`} type="button" onClick={addCartLine} disabled={!cartSession || !isCartMutable}>Add Line</button>

          <div className="space-y-2">
            {safeCartLines.map((line) => {
              const edit = lineEdits[line.id] ?? { quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount, taxRate: line.taxRate ?? 0 };
              return (
                <div key={line.id} className="grid gap-2 rounded border border-slate-700 p-3 md:grid-cols-8">
                  <div className="text-xs text-slate-300 md:col-span-2">
                    <p className="font-semibold text-slate-100">L#{line.lineNo} {line.productPack?.product.nameEn ?? 'Product pack'}</p>
                    <p>Pack {line.productPack?.code ?? line.productPackId.slice(0, 8)} | Batch {line.lotBatch?.batchNo ?? line.lotBatchId.slice(0, 8)}</p>
                  </div>
                  <input className="rounded border border-slate-700 bg-slate-950 p-2" type="number" min={1} step={1} value={edit.quantity} disabled={!isCartMutable} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, quantity: Number(e.target.value) || 1 } }))} />
                  <input className="rounded border border-slate-700 bg-slate-950 p-2" type="number" min={0} step={0.01} value={edit.unitPrice} disabled={!isCartMutable} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, unitPrice: Number(e.target.value) || 0 } }))} />
                  <input className="rounded border border-slate-700 bg-slate-950 p-2" type="number" min={0} step={0.01} value={edit.discount} disabled={!isCartMutable} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, discount: Number(e.target.value) || 0 } }))} />
                  <input className="rounded border border-slate-700 bg-slate-950 p-2" type="number" min={0} step={0.01} value={edit.taxRate} disabled={!isCartMutable} onChange={(e) => setLineEdits((cur) => ({ ...cur, [line.id]: { ...edit, taxRate: Number(e.target.value) || 0 } }))} />
                  <button className={`rounded bg-emerald-700 px-2 py-1 text-xs ${disabledControlClass}`} type="button" onClick={() => updateCartLine(line.id)} disabled={!isCartMutable}>Update</button>
                  <button className={`rounded bg-rose-700 px-2 py-1 text-xs ${disabledControlClass}`} type="button" onClick={() => removeCartLine(line.id)} disabled={!isCartMutable}>Remove</button>
                </div>
              );
            })}
          </div>

          {cartSession ? <div className="grid gap-2 rounded border border-slate-700 bg-slate-900/60 p-3 md:grid-cols-4"><p>Subtotal: {cartSession.subtotal.toFixed(2)}</p><p>Discount: {cartSession.discountTotal.toFixed(2)}</p><p>Tax: {cartSession.taxTotal.toFixed(2)}</p><p className="font-semibold">Grand: {cartSession.grandTotal.toFixed(2)} {cartSession.currency}</p></div> : null}

          <div className="grid gap-2 md:grid-cols-3">
            <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Cash tendered (optional)" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} disabled={!cartSession || !isCartMutable} />
            <button className={`rounded bg-emerald-700 px-3 py-2 text-sm font-medium ${disabledControlClass}`} type="button" onClick={finalizeCashSale} disabled={!cartSession || !isCartMutable}>Finalize Cash Sale</button>
            <button className="rounded border border-slate-600 px-3 py-2 text-sm" type="button" onClick={() => cartSession && void openCartSession(cartSession.id)} disabled={!cartSession}>Refresh Cart State</button>
          </div>

          {cartError ? <p className="text-sm text-rose-300">{cartError}</p> : null}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Return Flow / المرتجعات</h2>
            <p className="text-sm text-slate-300">Find a finalized sale by fiscal or session reference, review eligible lines, and create a bounded return against that sale only.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <h3 className="text-sm font-semibold text-cyan-200">Finalized sale lookup / بحث المبيعات النهائية</h3>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Search by fiscal or session reference" value={salesSearch} onChange={(e) => setSalesSearch(e.target.value)} />
                <button className="rounded bg-indigo-700 px-3 py-2 text-sm" type="button" onClick={refreshFinalizedSales}>Refresh Recent Sales</button>
              </div>
              <p className="text-xs text-slate-400">Scoped to branch <span className="font-semibold text-slate-200">{activeBranch?.name ?? branchId}</span> and register <span className="font-semibold text-slate-200">{activeRegister ? `${activeRegister.code} - ${activeRegister.nameEn}` : registerId || 'Not selected'}</span>.</p>

              {safeFinalizedSales.length ? (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {safeFinalizedSales.map((sale) => {
                    const payment = sale.paymentFinalizations?.[0] ?? null;
                    const isSelected = sale.id === selectedSaleId;
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => void loadSaleDetail(sale.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-100">{sale.documentNo}</p>
                            <p className="text-xs text-slate-300">Session reference: {sale.posCartSession?.sessionNumber ?? '-'}</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-200">{formatMoney(sale.grandTotal, sale.currency)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
                          <span>State: {sale.state}</span>
                          <span>Payment: {payment?.paymentMethod ?? '-'}</span>
                          <span>Finalized: {formatDateTime(payment?.finalizedAt ?? sale.finalizedAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded border border-dashed border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-400">
                  No finalized sales found for the current search and register scope.
                </div>
              )}
            </div>

            <div className="space-y-3">
              {selectedSaleDetail ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm">
                  <h3 className="text-sm font-semibold text-cyan-200">Return source sale / مرجع الإرجاع</h3>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <p>Fiscal reference: <span className="font-semibold">{selectedSaleDetail.documentNo}</span></p>
                    <p>Session reference: <span className="font-semibold">{selectedSaleDetail.posCartSession?.sessionNumber ?? '-'}</span></p>
                    <p>State: <span className="font-semibold">{selectedSaleDetail.state}</span></p>
                    <p>Payment mode: <span className="font-semibold">{selectedSalePayment?.paymentMethod ?? '-'}</span></p>
                    <p>Finalized at: <span className="font-semibold">{formatDateTime(selectedSalePayment?.finalizedAt ?? selectedSaleDetail.finalizedAt)}</span></p>
                    <p className="font-semibold">Total: {formatMoney(selectedSaleDetail.grandTotal, selectedSaleDetail.currency)}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-400">
                  Select a finalized sale from the lookup list to inspect returnable lines and start a return.
                </div>
              )}

              <button className={`rounded bg-cyan-700 px-3 py-2 text-sm ${disabledControlClass}`} type="button" onClick={createReturnSession} disabled={!selectedSaleDetail}>Create Return Session Against Selected Sale</button>

              {returnSession ? <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm"><p>Return session: <span className="font-semibold">{returnSession.returnNumber}</span></p><p>State: {returnSession.state}</p><p>Return fiscal reference: {returnSession.fiscalReturnDocument?.documentNo ?? returnSession.fiscalReturnDocumentId ?? '-'}</p><p className="font-semibold">Refund total: {formatMoney(returnSession.grandTotal, returnSession.currency)}</p></div> : null}

              {returnSession && !isReturnMutable ? <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-200">Return session is locked because state is {returnSession.state}. Add line/finalize controls are disabled.</p> : null}

              <div className="grid gap-3 md:grid-cols-4">
                <select className="rounded border border-slate-700 bg-slate-950 p-2 text-sm md:col-span-2" value={returnSourceLineId} onChange={(e) => { setReturnSourceLineId(e.target.value); const line = safeSelectedSaleLines.find((item) => item.id === e.target.value); setReturnUnitPrice(line?.unitPrice ?? 0); }} disabled={!isReturnMutable}>
                  <option value="">Select source sale line</option>
                  {safeSelectedSaleLines.map((line) => <option key={line.id} value={line.id}>#{line.lineNo} {line.productPack.product.nameEn} Batch {line.lotBatch?.batchNo ?? '-'} Remaining {line.remainingQty}</option>)}
                </select>
                <input className="rounded border border-slate-700 bg-slate-950 p-2" type="number" min={1} step={1} value={returnQuantity} disabled={!isReturnMutable} onChange={(e) => setReturnQuantity(Number(e.target.value) || 1)} />
                <input className="rounded border border-slate-700 bg-slate-950 p-2" type="number" min={0} step={0.01} value={returnUnitPrice} disabled={!isReturnMutable} onChange={(e) => setReturnUnitPrice(Number(e.target.value) || 0)} />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <button className={`rounded bg-indigo-700 px-3 py-2 text-sm ${disabledControlClass}`} type="button" onClick={addReturnLine} disabled={!isReturnMutable}>Add Return Line</button>
                <button className={`rounded bg-emerald-700 px-3 py-2 text-sm ${disabledControlClass}`} type="button" onClick={finalizeReturn} disabled={!isReturnMutable}>Finalize Return (Cash Refund)</button>
              </div>

              {returnSession ? <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm"><p>Subtotal: {returnSession.subtotal.toFixed(2)}</p><p>Discount: {returnSession.discountTotal.toFixed(2)}</p><p>Tax: {returnSession.taxTotal.toFixed(2)}</p><p className="font-semibold">Grand: {formatMoney(returnSession.grandTotal, returnSession.currency)}</p></div> : null}

              {selectedSaleDetail ? <div className="overflow-x-auto rounded border border-slate-700"><table className="min-w-full text-sm"><thead className="bg-slate-900 text-left text-slate-300"><tr><th className="p-2">Line</th><th className="p-2">Pack/Lot</th><th className="p-2">Sold Qty</th><th className="p-2">Already Returned</th><th className="p-2">Remaining</th></tr></thead><tbody>{safeSelectedSaleLines.map((line) => <tr key={line.id} className="border-t border-slate-800"><td className="p-2">{line.lineNo}</td><td className="p-2">{line.productPack.product.nameEn} / {line.lotBatch?.batchNo ?? '-'}</td><td className="p-2">{line.quantity}</td><td className="p-2">{line.alreadyReturnedQty}</td><td className="p-2 font-semibold">{line.remainingQty}</td></tr>)}</tbody></table></div> : null}
            </div>
          </div>

          {returnError ? <p className="text-sm text-rose-300">{returnError}</p> : null}
        </section>
      </section>
    </main>
  );
}




