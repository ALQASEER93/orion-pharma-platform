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
  SecondaryButton,
  SelectField,
  ShellNotice,
  TextAreaField,
} from '@/components/operator-shell';
import {
  buildOperatorHeaders,
  useOperatorSession,
} from '@/lib/operator-session';
import { getApiBase } from '@/lib/api-base';

type Supplier = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string;
};

type Product = {
  id: string;
  barcode: string;
  nameEn: string;
  nameAr?: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  totalQuantity: number;
  supplier: { nameEn: string; nameAr?: string };
};

type LineForm = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export default function PurchaseOrdersPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const session = useOperatorSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineForm[]>([
    { productId: '', quantity: 1, unitPrice: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function fetchLookupsAndOrders(branchId: string) {
    if (session.status !== 'ready') {
      return;
    }

    setError(null);
    const [suppliersResponse, productsResponse, ordersResponse] = await Promise.all([
      fetch(`${baseUrl}/suppliers?isActive=true`, {
        headers: buildOperatorHeaders(session),
        cache: 'no-store',
      }),
      fetch(
        `${baseUrl}/products?isActive=true&limit=100&branchId=${encodeURIComponent(branchId)}`,
        {
          headers: buildOperatorHeaders(session),
          cache: 'no-store',
        },
      ),
      fetch(
        `${baseUrl}/purchase-orders?branchId=${encodeURIComponent(branchId)}`,
        {
          headers: buildOperatorHeaders(session),
          cache: 'no-store',
        },
      ),
    ]);

    if (!suppliersResponse.ok || !productsResponse.ok || !ordersResponse.ok) {
      throw new Error('Failed to load purchase order lookups.');
    }

    const suppliersData = (await suppliersResponse.json()) as Supplier[];
    const productsData = (await productsResponse.json()) as Product[];
    const ordersData = (await ordersResponse.json()) as PurchaseOrder[];

    setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    setProducts(Array.isArray(productsData) ? productsData : []);
    setOrders(Array.isArray(ordersData) ? ordersData : []);

    if (!supplierId && suppliersData[0]) {
      setSupplierId(suppliersData[0].id);
    }
  }

  useEffect(() => {
    if (session.status !== 'ready') {
      return;
    }

    fetchLookupsAndOrders(session.branchId).catch((requestError) => {
      setError((requestError as Error).message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, session.accessToken, session.branchId, session.status, session.tenantId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (session.status !== 'ready') {
      setError('Local branch session is still preparing.');
      return;
    }

    const filteredLines = lines.filter((line) => line.productId);
    if (!supplierId || filteredLines.length === 0) {
      setError('Choose one supplier and at least one order line.');
      return;
    }

    const response = await fetch(`${baseUrl}/purchase-orders`, {
      method: 'POST',
      headers: buildOperatorHeaders(session),
      body: JSON.stringify({
        branchId: session.branchId,
        supplierId,
        notes,
        lines: filteredLines,
      }),
    });

    if (!response.ok) {
      setError(`Purchase order creation failed (${response.status})`);
      return;
    }

    setNotes('');
    setLines([{ productId: '', quantity: 1, unitPrice: 0 }]);
    setStatusMessage('Purchase order saved for this branch.');
    await fetchLookupsAndOrders(session.branchId);
  }

  return (
    <OperatorFrame
      currentPath="/purchase-orders"
      eyebrow="Procurement desk"
      title="Purchase orders prepared for the active branch"
      description="أنشئ أمر شراء واضحاً من اسم المورد والصنف، مع إبقاء الفرع الجاري محدداً بالاسم وسياق الجلسة المحلية."
      session={session}
    >
      {statusMessage ? (
        <ShellNotice title="Updated" body={statusMessage} tone="success" />
      ) : null}
      {error ? <ShellNotice title="Action blocked" body={error} tone="error" /> : null}

      <SectionCard
        title="Create purchase order"
        subtitle="The branch comes from the current local session. Supplier and product selection stay label-driven."
      >
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="branch-name">Branch</FieldLabel>
              <SelectField
                id="branch-name"
                value={session.branchId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => session.setActiveBranch(event.target.value)}
              >
                {session.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="supplier">Supplier</FieldLabel>
              <SelectField
                id="supplier"
                value={supplierId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setSupplierId(event.target.value)}
              >
                <option value="">Choose supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} · {supplier.nameEn}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="po-notes">Order notes</FieldLabel>
            <TextAreaField
              id="po-notes"
              placeholder="Delivery timing, requested brands, or receiving note"
              value={notes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Order lines</p>
                <p className="text-sm text-slate-400">
                  Choose the product by label, then confirm quantity and unit
                  price.
                </p>
              </div>
              <SecondaryButton
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    { productId: '', quantity: 1, unitPrice: 0 },
                  ])
                }
                type="button"
              >
                Add line
              </SecondaryButton>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={`line-${index}`}
                  className="grid gap-3 rounded-3xl border border-slate-800 bg-slate-900/50 p-4 lg:grid-cols-[minmax(0,1fr)_140px_160px_auto]"
                >
                  <div className="space-y-2">
                    <FieldLabel htmlFor={`line-product-${index}`}>Product</FieldLabel>
                    <SelectField
                      id={`line-product-${index}`}
                      value={line.productId}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          productId: event.target.value,
                        };
                        setLines(next);
                      }}
                    >
                      <option value="">Choose product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.nameEn} · {product.barcode}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor={`line-qty-${index}`}>Quantity</FieldLabel>
                    <InputField
                      id={`line-qty-${index}`}
                      min={1}
                      type="number"
                      value={line.quantity}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          quantity: Number(event.target.value) || 1,
                        };
                        setLines(next);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor={`line-price-${index}`}>Unit price</FieldLabel>
                    <InputField
                      id={`line-price-${index}`}
                      min={0}
                      step={0.01}
                      type="number"
                      value={line.unitPrice}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          unitPrice: Number(event.target.value) || 0,
                        };
                        setLines(next);
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <SecondaryButton
                      className="w-full"
                      onClick={() =>
                        setLines((current) =>
                          current.length === 1
                            ? current
                            : current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      type="button"
                    >
                      Remove
                    </SecondaryButton>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <PrimaryButton type="submit">Save purchase order</PrimaryButton>
        </form>
      </SectionCard>

      <SectionCard
        title="Recent orders for this branch"
        subtitle="The list keeps the branch scope explicit without exposing raw identifiers."
      >
        {orders.length ? (
          <div className="overflow-hidden rounded-[24px] border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3">PO number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-800 bg-slate-950/50">
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {order.poNumber}
                    </td>
                    <td className="px-4 py-3">{order.supplier?.nameEn}</td>
                    <td className="px-4 py-3">{order.status}</td>
                    <td className="px-4 py-3">{order.totalQuantity}</td>
                    <td className="px-4 py-3">{order.totalAmount.toFixed(2)} JOD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No purchase orders for this branch yet"
            body="Create the first order above, or switch the branch to inspect another local operating context."
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
