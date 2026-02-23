'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../lib/api-base';

type Product = {
  id: string;
  nameAr: string;
  nameEn: string;
  barcode: string;
  strength: string;
  packSize: string;
  trackingMode: 'NONE' | 'EXPIRY_ONLY' | 'LOT_EXPIRY';
};

type ProductForm = {
  nameAr: string;
  nameEn: string;
  barcode: string;
  strength: string;
  packSize: string;
  trackingMode: Product['trackingMode'];
};

const emptyForm: ProductForm = {
  nameAr: '',
  nameEn: '',
  barcode: '',
  strength: '',
  packSize: '',
  trackingMode: 'NONE',
};

export default function ProductsPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const [tenantId, setTenantId] = useState('11111111-1111-1111-1111-111111111111');
  const [token, setToken] = useState('');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchProducts() {
    if (!token) {
      return;
    }
    const response = await fetch(
      `${baseUrl}/products${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to load products (${response.status})`);
    }
    const data = (await response.json()) as Product[];
    setProducts(data);
  }

  useEffect(() => {
    fetchProducts().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, query]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const endpoint = editingId
      ? `${baseUrl}/products/${editingId}`
      : `${baseUrl}/products`;
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
    await fetchProducts();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-sm text-slate-300">
          Search and manage product master data (AR/EN + barcode).
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
          placeholder="Search by AR/EN name or barcode"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <form className="grid gap-2 md:grid-cols-3" onSubmit={submit}>
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Arabic name" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="English name" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Strength" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} />
          <input className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Pack size" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} />
          <select className="rounded border border-slate-700 bg-slate-950 p-2" value={form.trackingMode} onChange={(e) => setForm({ ...form, trackingMode: e.target.value as Product['trackingMode'] })}>
            <option value="NONE">NONE</option>
            <option value="EXPIRY_ONLY">EXPIRY_ONLY</option>
            <option value="LOT_EXPIRY">LOT_EXPIRY</option>
          </select>
          <button className="rounded bg-cyan-700 p-2 font-medium text-white md:col-span-3" type="submit">
            {editingId ? 'Update Product' : 'Create Product'}
          </button>
        </form>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="p-2">AR</th>
                <th className="p-2">EN</th>
                <th className="p-2">Barcode</th>
                <th className="p-2">Tracking</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-slate-800">
                  <td className="p-2">{product.nameAr}</td>
                  <td className="p-2">{product.nameEn}</td>
                  <td className="p-2">{product.barcode}</td>
                  <td className="p-2">{product.trackingMode}</td>
                  <td className="p-2">
                    <button
                      className="rounded bg-slate-700 px-2 py-1"
                      onClick={() => {
                        setEditingId(product.id);
                        setForm({
                          nameAr: product.nameAr,
                          nameEn: product.nameEn,
                          barcode: product.barcode,
                          strength: product.strength,
                          packSize: product.packSize,
                          trackingMode: product.trackingMode,
                        });
                      }}
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
