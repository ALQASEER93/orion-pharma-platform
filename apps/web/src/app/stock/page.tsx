'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  FieldLabel,
  OperatorFrame,
  OperatorSupportPanel,
  PrimaryButton,
  SectionCard,
  SelectField,
  ShellNotice,
} from '@/components/operator-shell';
import {
  buildOperatorHeaders,
  useOperatorSession,
} from '@/lib/operator-session';
import { getApiBase } from '@/lib/api-base';

type ProductOption = {
  id: string;
  nameEn: string;
  barcode: string;
};

type StockRow = {
  branchId: string;
  productId: string;
  batchNo: string | null;
  quantity: number;
};

export default function StockPage() {
  const baseUrl = useMemo(() => getApiBase(), []);
  const session = useOperatorSession();
  const [productId, setProductId] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.nameEn])),
    [products],
  );

  async function loadProducts(branchId: string) {
    if (session.status !== 'ready') {
      return;
    }

    const response = await fetch(
      `${baseUrl}/products?isActive=true&limit=120&branchId=${encodeURIComponent(branchId)}`,
      {
        headers: buildOperatorHeaders(session),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to load products (${response.status})`);
    }

    const payload = (await response.json()) as ProductOption[];
    setProducts(Array.isArray(payload) ? payload : []);
  }

  async function loadStock(event?: FormEvent) {
    event?.preventDefault();
    setError(null);

    if (session.status !== 'ready') {
      setError('Local operator session is not ready yet.');
      return;
    }

    const params = new URLSearchParams();
    params.set('branchId', session.branchId);
    if (productId) params.set('productId', productId);

    const response = await fetch(
      `${baseUrl}/inventory/stock-on-hand?${params.toString()}`,
      {
        headers: buildOperatorHeaders(session),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      setError(`Failed to load stock (${response.status})`);
      return;
    }

    setRows((await response.json()) as StockRow[]);
  }

  useEffect(() => {
    if (session.status !== 'ready') {
      return;
    }

    loadProducts(session.branchId)
      .then(() => loadStock())
      .catch((requestError) => setError((requestError as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, session.branchId, session.status]);

  return (
    <OperatorFrame
      currentPath="/stock"
      eyebrow="Stock visibility"
      title="Branch stock review with calmer operator filters"
      description="يعرض رصيد الفرع الحالي مع اختيار الفرع والصنف بالاسم، بدلاً من إدخال معرفات تقنية يدوياً."
      session={session}
    >
      {error ? <ShellNotice title="Action blocked" body={error} tone="error" /> : null}

      <SectionCard
        title="Stock filters"
        subtitle="Change the branch by name, then narrow the result to one product when needed."
      >
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={loadStock}>
          <div className="space-y-2">
            <FieldLabel htmlFor="stock-branch">Branch</FieldLabel>
            <SelectField
              id="stock-branch"
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
            <FieldLabel htmlFor="stock-product">Product</FieldLabel>
            <SelectField
              id="stock-product"
              value={productId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setProductId(event.target.value)}
            >
              <option value="">All active products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.nameEn} · {product.barcode}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="flex items-end">
            <PrimaryButton className="w-full" type="submit">
              Refresh stock view
            </PrimaryButton>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Stock on hand"
        subtitle={`Current branch scope: ${session.branchName}`}
      >
        {rows.length ? (
          <div className="overflow-hidden rounded-[24px] border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.branchId}:${row.productId}:${row.batchNo ?? ''}:${index}`}
                    className="border-t border-slate-800 bg-slate-950/50"
                  >
                    <td className="px-4 py-3">{session.branchName}</td>
                    <td className="px-4 py-3">
                      {productNames.get(row.productId) ?? 'Selected product'}
                    </td>
                    <td className="px-4 py-3">{row.batchNo ?? '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {row.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No stock rows for the current filter"
            body="Choose another branch or product, then refresh the view to inspect available quantities."
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
