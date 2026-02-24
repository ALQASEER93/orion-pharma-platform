'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../lib/api-base';

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
  const [tenantId, setTenantId] = useState('11111111-1111-1111-1111-111111111111');
  const [token, setToken] = useState('');
  const [query, setQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchSuppliers() {
    if (!token) {
      return;
    }

    const response = await fetch(
      `${baseUrl}/suppliers${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to load suppliers (${response.status})`);
    }

    const data = (await response.json()) as Supplier[];
    setSuppliers(data);
  }

  useEffect(() => {
    fetchSuppliers().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, query]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const endpoint = editingId
      ? `${baseUrl}/suppliers/${editingId}`
      : `${baseUrl}/suppliers`;
    const method = editingId ? 'PATCH' : 'POST';
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setError(`Save failed (${response.status})`);
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    await fetchSuppliers();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="text-sm text-slate-300">
          Manage tenant suppliers for upcoming procurement flows.
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
          placeholder="Search by code or AR/EN name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <form className="grid gap-2 md:grid-cols-3" onSubmit={submit}>
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Supplier code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Arabic name"
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="English name"
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Contact name"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <label className="flex items-center gap-2 md:col-span-3">
            <input
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              type="checkbox"
            />
            Active supplier
          </label>
          <button className="rounded bg-cyan-700 p-2 font-medium text-white md:col-span-3" type="submit">
            {editingId ? 'Update Supplier' : 'Create Supplier'}
          </button>
        </form>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="p-2">Code</th>
                <th className="p-2">AR</th>
                <th className="p-2">EN</th>
                <th className="p-2">Contact</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-slate-800">
                  <td className="p-2">{supplier.code}</td>
                  <td className="p-2">{supplier.nameAr}</td>
                  <td className="p-2">{supplier.nameEn}</td>
                  <td className="p-2">{supplier.contactName ?? '-'}</td>
                  <td className="p-2">{supplier.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="p-2">
                    <button
                      className="rounded bg-slate-700 px-2 py-1"
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
                      Edit
                    </button>
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
