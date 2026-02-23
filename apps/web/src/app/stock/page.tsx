'use client';

import { FormEvent, useMemo, useState } from 'react';
import { getApiBase } from '../../lib/api-base';

type StockRow = {
  branchId: string;
  productId: string;
  batchNo: string | null;
  quantity: number;
};

export default function StockPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const [tenantId, setTenantId] = useState('11111111-1111-1111-1111-111111111111');
  const [token, setToken] = useState('');
  const [branchId, setBranchId] = useState('');
  const [productId, setProductId] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    if (!token) {
      setError('Bearer token is required.');
      return;
    }

    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (productId) params.set('productId', productId);

    const response = await fetch(
      `${baseUrl}/inventory/stock-on-hand?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      },
    );
    if (!response.ok) {
      setError(`Failed to load stock (${response.status})`);
      return;
    }
    setRows((await response.json()) as StockRow[]);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">Stock On Hand</h1>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={load}>
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Bearer token" value={token} onChange={(e) => setToken(e.target.value)} />
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Branch ID (optional)" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Product ID (optional)" value={productId} onChange={(e) => setProductId(e.target.value)} />
          <button className="rounded bg-emerald-700 p-2 font-medium text-white md:col-span-2" type="submit">
            Load Stock
          </button>
        </form>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="p-2">Branch</th>
                <th className="p-2">Product</th>
                <th className="p-2">Batch</th>
                <th className="p-2">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.branchId}:${row.productId}:${row.batchNo ?? ''}:${idx}`} className="border-t border-slate-800">
                  <td className="p-2">{row.branchId}</td>
                  <td className="p-2">{row.productId}</td>
                  <td className="p-2">{row.batchNo ?? '-'}</td>
                  <td className="p-2">{row.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
