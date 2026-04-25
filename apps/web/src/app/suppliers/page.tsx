'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  FieldLabel,
  InputField,
  OperatorFrame,
  OperatorSupportPanel,
  PrimaryButton,
  SectionCard,
  ShellNotice,
} from '@/components/operator-shell';
import {
  buildOperatorHeaders,
  useOperatorSession,
} from '@/lib/operator-session';
import { getApiBase } from '@/lib/api-base';

type Supplier = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

type SupplierForm = {
  code: string;
  nameAr: string;
  nameEn: string;
  contactName: string;
  email: string;
  phone: string;
  isActive: boolean;
};

const emptyForm: SupplierForm = {
  code: '',
  nameAr: '',
  nameEn: '',
  contactName: '',
  email: '',
  phone: '',
  isActive: true,
};

export default function SuppliersPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const session = useOperatorSession();
  const [query, setQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchSuppliers(currentQuery: string) {
    if (session.status !== 'ready') {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${baseUrl}/suppliers${currentQuery ? `?q=${encodeURIComponent(currentQuery)}` : ''}`,
        {
          headers: buildOperatorHeaders(session),
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to load suppliers (${response.status})`);
      }

      const data = (await response.json()) as Supplier[];
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session.status !== 'ready') {
      return;
    }
    void fetchSuppliers(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, query, session.accessToken, session.status, session.tenantId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (session.status !== 'ready') {
      setError('Operator session is not ready yet.');
      return;
    }

    const endpoint = editingId
      ? `${baseUrl}/suppliers/${editingId}`
      : `${baseUrl}/suppliers`;
    const method = editingId ? 'PATCH' : 'POST';

    const response = await fetch(endpoint, {
      method,
      headers: buildOperatorHeaders(session),
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setError(`Supplier save failed (${response.status})`);
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    setStatusMessage(
      editingId
        ? 'Supplier details were updated.'
        : 'Supplier added to the local operating list.',
    );
    await fetchSuppliers(query);
  }

  return (
    <OperatorFrame
      currentPath="/suppliers"
      eyebrow="Supplier desk"
      title="Trusted supplier records for daily procurement work"
      description="راجع الموردين وحدث بياناتهم من سطح تشغيلي واضح، مع إبقاء السياق التقني محصوراً في لوحة المساندة فقط."
      session={session}
    >
      {statusMessage ? (
        <ShellNotice title="Updated" body={statusMessage} tone="success" />
      ) : null}
      {error ? <ShellNotice title="Action blocked" body={error} tone="error" /> : null}

      <SectionCard
        title="Supplier list"
        subtitle="Search by supplier code or Arabic / English name."
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <FieldLabel htmlFor="supplier-search">Search suppliers</FieldLabel>
            <InputField
              id="supplier-search"
              placeholder="Example: SUP-ORION or المورد الطبي"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            />
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Active branch
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-50">
              {session.branchName}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Shared session context is applied automatically.
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Arabic name</th>
                <th className="px-4 py-3">English name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-slate-800 bg-slate-950/50">
                  <td className="px-4 py-3 font-medium text-slate-100">
                    {supplier.code}
                  </td>
                  <td className="px-4 py-3">{supplier.nameAr}</td>
                  <td className="px-4 py-3">{supplier.nameEn}</td>
                  <td className="px-4 py-3">
                    {supplier.contactName ?? supplier.phone ?? supplier.email ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    {supplier.isActive ? 'Active / نشط' : 'Inactive / غير نشط'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-slate-500"
                      onClick={() => {
                        setEditingId(supplier.id);
                        setForm({
                          code: supplier.code,
                          nameAr: supplier.nameAr,
                          nameEn: supplier.nameEn,
                          contactName: supplier.contactName ?? '',
                          email: supplier.email ?? '',
                          phone: supplier.phone ?? '',
                          isActive: supplier.isActive,
                        });
                      }}
                      type="button"
                    >
                      Edit record
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && suppliers.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No suppliers match this search"
                body="Try a different name or code, or add the supplier from the form below."
              />
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={editingId ? 'Update supplier details' : 'Add a supplier'}
        subtitle="Fields use clear labels so the purchasing team can update records without guessing from placeholders."
      >
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={submit}>
          <div className="space-y-2">
            <FieldLabel htmlFor="supplier-code">Supplier code</FieldLabel>
            <InputField
              id="supplier-code"
              value={form.code}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((current) => ({ ...current, code: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="supplier-contact">Contact name</FieldLabel>
            <InputField
              id="supplier-contact"
              value={form.contactName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((current) => ({
                  ...current,
                  contactName: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="supplier-name-ar">Arabic supplier name</FieldLabel>
            <InputField
              id="supplier-name-ar"
              value={form.nameAr}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((current) => ({ ...current, nameAr: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="supplier-name-en">English supplier name</FieldLabel>
            <InputField
              id="supplier-name-en"
              value={form.nameEn}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((current) => ({ ...current, nameEn: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="supplier-email">Email</FieldLabel>
            <InputField
              id="supplier-email"
              type="email"
              value={form.email}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="supplier-phone">Phone</FieldLabel>
            <InputField
              id="supplier-phone"
              value={form.phone}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-200 lg:col-span-2">
            <input
              checked={form.isActive}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Supplier is active and available for new purchase activity
          </label>
          <div className="flex flex-wrap gap-3 lg:col-span-2">
            <PrimaryButton type="submit">
              {editingId ? 'Save supplier changes' : 'Add supplier'}
            </PrimaryButton>
            {editingId ? (
              <button
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                type="button"
              >
                Cancel editing
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <OperatorSupportPanel
        session={session}
        onRefresh={() => {
          setError(null);
          void session.refreshSession();
        }}
      />
    </OperatorFrame>
  );
}
