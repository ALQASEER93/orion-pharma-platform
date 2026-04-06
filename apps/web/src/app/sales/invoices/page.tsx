'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  FieldLabel,
  InputField,
  OperatorFrame,
  OperatorSupportPanel,
  SectionCard,
  ShellNotice,
} from '@/components/operator-shell';
import {
  buildOperatorHeaders,
  useOperatorSession,
} from '@/lib/operator-session';
import { getApiBase } from '@/lib/api-base';

type Invoice = {
  id: string;
  invoiceNo: string;
  status: string;
  currency: string;
  grandTotal: number;
  issuedAt: string;
  customer: { name: string } | null;
};

function formatIssuedAt(value: string) {
  return new Intl.DateTimeFormat('en-JO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function SalesInvoicesPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const session = useOperatorSession();
  const [query, setQuery] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status !== 'ready') {
      return;
    }

    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    fetch(`${baseUrl}/sales/invoices${qs}`, {
      headers: buildOperatorHeaders(session),
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load invoices (${response.status})`);
        }
        return (await response.json()) as Invoice[];
      })
      .then((payload) => {
        setInvoices(Array.isArray(payload) ? payload : []);
      })
      .catch((requestError) => {
        setError((requestError as Error).message);
      });
  }, [baseUrl, query, session.status, session.accessToken, session.tenantId]);

  return (
    <OperatorFrame
      currentPath="/sales/invoices"
      eyebrow="Invoice review"
      title="Sales invoices in a calmer review surface"
      description="استعرض الفواتير النهائية والمسودات بسرعة، مع تركيز أوضح على العميل والتاريخ والإجمالي بدلاً من حقول الإعداد الداخلية."
      session={session}
    >
      {error ? <ShellNotice title="Action blocked" body={error} tone="error" /> : null}

      <SectionCard
        title="Invoice search"
        subtitle="Search by invoice number or customer name."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-2">
            <FieldLabel htmlFor="invoice-search">Search invoices</FieldLabel>
            <InputField
              id="invoice-search"
              placeholder="Invoice no. or customer name"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            />
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Session branch
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-50">
              {session.branchName}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Current operator context is applied automatically.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Invoices"
        subtitle="Operator-facing review of status, customer, issue time, and total."
      >
        {invoices.length ? (
          <div className="overflow-hidden rounded-[24px] border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-slate-800 bg-slate-950/50">
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {invoice.invoiceNo}
                    </td>
                    <td className="px-4 py-3">
                      {invoice.customer?.name ?? 'Walk-in / زائر'}
                    </td>
                    <td className="px-4 py-3">{invoice.status}</td>
                    <td className="px-4 py-3">{formatIssuedAt(invoice.issuedAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {invoice.grandTotal.toFixed(2)} {invoice.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No invoices match this search"
            body="Try another invoice reference or customer name to widen the results."
          />
        )}
      </SectionCard>

      <OperatorSupportPanel
        session={session}
        onRefresh={() => {
          void session.refreshSession();
        }}
      />
    </OperatorFrame>
  );
}
