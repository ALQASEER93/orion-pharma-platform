'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../lib/api-base';

type Supplier = {
  id: string;
  code: string;
  nameEn: string;
};

type Product = {
  id: string;
  barcode: string;
  nameEn: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  totalQuantity: number;
  supplier: { nameEn: string };
};

type LineForm = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

const defaultTenant = '11111111-1111-1111-1111-111111111111';
const defaultBranch = '22222222-2222-2222-2222-222222222222';

export default function PurchaseOrdersPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [branchId, setBranchId] = useState(defaultBranch);
  const [token, setToken] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineForm[]>([
    { productId: '', quantity: 1, unitPrice: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);

  async function fetchLookups() {
    if (!token) {
      return;
    }

    const [suppliersResponse, productsResponse] = await Promise.all([
      fetch(`${baseUrl}/suppliers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      }),
      fetch(`${baseUrl}/products`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      }),
    ]);

    if (!suppliersResponse.ok || !productsResponse.ok) {
      throw new Error('Failed to load suppliers/products');
    }

    const suppliersData = (await suppliersResponse.json()) as Supplier[];
    const productsData = (await productsResponse.json()) as Product[];
    setSuppliers(suppliersData);
    setProducts(productsData);
    if (!supplierId && suppliersData.length > 0) {
      setSupplierId(suppliersData[0].id);
    }
  }

  async function fetchOrders() {
    if (!token) {
      return;
    }

    const response = await fetch(`${baseUrl}/purchase-orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load purchase orders (${response.status})`);
    }

    const data = (await response.json()) as PurchaseOrder[];
    setOrders(data);
  }

  useEffect(() => {
    Promise.all([fetchLookups(), fetchOrders()]).catch((e: Error) =>
      setError(e.message),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const filteredLines = lines.filter((line) => line.productId);
    if (!supplierId || filteredLines.length === 0) {
      setError('Supplier and at least one line are required.');
      return;
    }

    const response = await fetch(`${baseUrl}/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        branchId,
        supplierId,
        notes,
        lines: filteredLines,
      }),
    });

    if (!response.ok) {
      setError(`Create PO failed (${response.status})`);
      return;
    }

    setNotes('');
    setLines([{ productId: '', quantity: 1, unitPrice: 0 }]);
    await fetchOrders();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-6xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <p className="text-sm text-slate-300">
          Slice 2 core: create and list draft purchase orders.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Tenant ID"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Branch ID"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Bearer token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <form className="space-y-3 rounded-xl border border-slate-800 p-4" onSubmit={submit}>
          <h2 className="text-lg font-medium">Create Draft PO</h2>
          <select
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} - {supplier.nameEn}
              </option>
            ))}
          </select>

          <input
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={`line-${index}`} className="grid gap-2 md:grid-cols-4">
                <select
                  className="rounded border border-slate-700 bg-slate-950 p-2"
                  value={line.productId}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...next[index], productId: e.target.value };
                    setLines(next);
                  }}
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.barcode} - {product.nameEn}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded border border-slate-700 bg-slate-950 p-2"
                  min={1}
                  type="number"
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = {
                      ...next[index],
                      quantity: Number(e.target.value) || 1,
                    };
                    setLines(next);
                  }}
                />
                <input
                  className="rounded border border-slate-700 bg-slate-950 p-2"
                  min={0}
                  step={0.01}
                  type="number"
                  value={line.unitPrice}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = {
                      ...next[index],
                      unitPrice: Number(e.target.value) || 0,
                    };
                    setLines(next);
                  }}
                />
                <button
                  className="rounded bg-rose-700 px-3 py-2 text-sm"
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1
                        ? current
                        : current.filter((_, i) => i !== index),
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="rounded bg-slate-700 px-3 py-2 text-sm"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { productId: '', quantity: 1, unitPrice: 0 },
                ])
              }
              type="button"
            >
              Add Line
            </button>
            <button className="rounded bg-cyan-700 px-4 py-2 text-sm" type="submit">
              Create Draft PO
            </button>
          </div>
        </form>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="p-2">PO Number</th>
                <th className="p-2">Supplier</th>
                <th className="p-2">Status</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-800">
                  <td className="p-2">{order.poNumber}</td>
                  <td className="p-2">{order.supplier?.nameEn}</td>
                  <td className="p-2">{order.status}</td>
                  <td className="p-2">{order.totalQuantity}</td>
                  <td className="p-2">{order.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
