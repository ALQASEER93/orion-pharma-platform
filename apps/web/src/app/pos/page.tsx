'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../lib/api-base';

type Product = {
  id: string;
  barcode: string;
  nameEn: string;
  nameAr: string;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
};

type CartLine = {
  productId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
};

type CheckoutResult = {
  invoiceNo: string;
  grandTotal: number;
  currency: string;
};

const defaultTenant = '11111111-1111-1111-1111-111111111111';

export default function PosPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [token, setToken] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CheckoutResult | null>(null);

  const total = cart.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);

  async function fetchLookups() {
    if (!token) {
      return;
    }

    const [productsResponse, customersResponse] = await Promise.all([
      fetch(`${baseUrl}/products`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      }),
      fetch(`${baseUrl}/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      }),
    ]);

    if (!productsResponse.ok || !customersResponse.ok) {
      throw new Error('Failed to load POS lookup data.');
    }

    setProducts((await productsResponse.json()) as Product[]);
    setCustomers((await customersResponse.json()) as Customer[]);
  }

  useEffect(() => {
    fetchLookups().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId]);

  function addProductToCart() {
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) {
      return;
    }

    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          itemName: product.nameEn || product.nameAr,
          qty: 1,
          unitPrice: 0,
        },
      ];
    });
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (cart.length === 0) {
      setError('Cart is empty.');
      return;
    }

    const response = await fetch(`${baseUrl}/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        customerId: customerId || undefined,
        lines: cart.map((line) => ({
          productId: line.productId,
          itemName: line.itemName,
          qty: line.qty,
          unitPrice: line.unitPrice,
        })),
        payment: {
          method: 'CASH',
          amount: Number(total.toFixed(2)),
        },
      }),
    });

    if (!response.ok) {
      setError(`Checkout failed (${response.status})`);
      return;
    }

    const payload = (await response.json()) as CheckoutResult;
    setSuccess(payload);
    setCart([]);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-semibold">POS / نقطة البيع</h1>
        <p className="text-sm text-slate-300">Minimal checkout for Slice 2.</p>

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

        <form className="space-y-3 rounded-xl border border-slate-800 p-4" onSubmit={checkout}>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded border border-slate-700 bg-slate-950 p-2"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">Select item / اختر صنف</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.barcode} - {product.nameEn}
                </option>
              ))}
            </select>
            <button
              className="rounded bg-cyan-700 px-3 py-2 text-sm"
              type="button"
              onClick={addProductToCart}
            >
              Add Item / إضافة
            </button>
          </div>

          <select
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Walk-in / زائر</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.phone ? `(${customer.phone})` : ''}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            {cart.map((line, index) => (
              <div key={`${line.productId}-${index}`} className="grid gap-2 md:grid-cols-4">
                <input
                  className="rounded border border-slate-700 bg-slate-950 p-2"
                  value={line.itemName}
                  onChange={(e) =>
                    setCart((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, itemName: e.target.value } : item,
                      ),
                    )
                  }
                />
                <input
                  className="rounded border border-slate-700 bg-slate-950 p-2"
                  min={0.000001}
                  step={1}
                  type="number"
                  value={line.qty}
                  onChange={(e) =>
                    setCart((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, qty: Number(e.target.value) || 1 }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  className="rounded border border-slate-700 bg-slate-950 p-2"
                  min={0}
                  step={0.01}
                  type="number"
                  value={line.unitPrice}
                  onChange={(e) =>
                    setCart((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, unitPrice: Number(e.target.value) || 0 }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  className="rounded bg-rose-700 px-3 py-2 text-sm"
                  type="button"
                  onClick={() =>
                    setCart((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 p-3">
            <span>Total / الإجمالي</span>
            <span className="font-semibold">{total.toFixed(2)} JOD</span>
          </div>

          <button className="w-full rounded bg-emerald-700 px-4 py-2 font-medium" type="submit">
            Checkout / إنهاء البيع
          </button>
        </form>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {success ? (
          <div className="rounded border border-emerald-700 bg-emerald-900/20 p-3 text-emerald-200">
            Invoice {success.invoiceNo} created. Total {success.grandTotal.toFixed(2)}{' '}
            {success.currency}
          </div>
        ) : null}
      </section>
    </main>
  );
}
