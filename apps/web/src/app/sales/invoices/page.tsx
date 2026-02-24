'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../../lib/api-base';

type Invoice = {
  id: string;
  invoiceNo: string;
  status: string;
  currency: string;
  grandTotal: number;
  issuedAt: string;
  customer: { name: string } | null;
};

export default function SalesInvoicesPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const [tenantId, setTenantId] = useState('11111111-1111-1111-1111-111111111111');
  const [token, setToken] = useState('');
  const [query, setQuery] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchInvoices() {
    if (!token) {
      return;
    }

    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    const response = await fetch(`${baseUrl}/sales/invoices${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load invoices (${response.status})`);
    }

    const data = (await response.json()) as Invoice[];
    setInvoices(data);
  }

  useEffect(() => {
    fetchInvoices().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, query]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-6xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">Sales Invoices / فواتير المبيعات</h1>
        <p className="text-sm text-slate-300">
          Minimal list view for posted and draft invoices.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Tenant ID"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Bearer token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <input
          className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          placeholder="Search by invoice no / customer"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="p-2">Invoice</th>
                <th className="p-2">Customer</th>
                <th className="p-2">Status</th>
                <th className="p-2">Issued</th>
                <th className="p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-slate-800">
                  <td className="p-2">{invoice.invoiceNo}</td>
                  <td className="p-2">{invoice.customer?.name ?? 'Walk-in / زائر'}</td>
                  <td className="p-2">{invoice.status}</td>
                  <td className="p-2">
                    {new Date(invoice.issuedAt).toLocaleString('en-GB')}
                  </td>
                  <td className="p-2">
                    {invoice.grandTotal.toFixed(2)} {invoice.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
