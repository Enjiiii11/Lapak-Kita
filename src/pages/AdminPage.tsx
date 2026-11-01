import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { formatRupiah, formatWeight } from '@/lib/format';
import { apiRequest } from '@/lib/api';
import type { Product } from '@/types/marketplace';

type LoadState = 'loading' | 'ready' | 'error';

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadState('loading');
    try {
      const data = await apiRequest<Product[]>('products');
      setProducts(data);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term),
    );
  }, [products, query]);

  const deleteProduct = async (product: Product) => {
    setDeletingId(product.id);
    setActionError(null);
    let failed = false;
    try {
      await apiRequest(`products/${product.id}`, { method: 'DELETE' });
    } catch {
      failed = true;
    }
    setDeletingId(null);
    setConfirmingId(null);
    if (failed) {
      setActionError(`We could not delete "${product.name}". Please try again.`);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-orange-600">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-stone-900">All listings</h1>
          <p className="mt-1 text-sm text-stone-500">Review every product in the shop and remove any listing.</p>
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search listings</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or category"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </label>
      </div>

      {actionError && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {actionError}
        </p>
      )}

      {loadState === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-24 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading listings...
        </div>
      )}

      {loadState === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-rose-600" aria-hidden="true" />
          <p className="font-medium text-rose-800">We could not load the listings right now.</p>
          <button
            type="button"
            onClick={() => void loadProducts()}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && visibleProducts.length === 0 && (
        <p className="rounded-3xl border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-500">
          {products.length === 0 ? 'There are no listings in the shop.' : 'No listings match your search.'}
        </p>
      )}

      {loadState === 'ready' && visibleProducts.length > 0 && (
        <ul className="space-y-3">
          {visibleProducts.map((product) => {
            const confirming = confirmingId === product.id;
            const deleting = deletingId === product.id;
            return (
              <li
                key={product.id}
                className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900">{product.name}</p>
                  <p className="text-sm text-stone-500">
                    {product.category} · {formatRupiah(product.price_idr)} · {product.stock} in stock ·{' '}
                    {formatWeight(product.weight_kg)}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    {product.seller_id ? `Seller ${product.seller_id.slice(0, 8)}` : 'Platform listing'}
                  </p>
                </div>

                {confirming ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-stone-600">Delete this listing?</span>
                    <button
                      type="button"
                      onClick={() => void deleteProduct(product)}
                      disabled={deleting}
                      className="flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-70"
                    >
                      {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(product.id)}
                    aria-label={`Delete ${product.name}`}
                    className="flex items-center gap-2 self-start rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 sm:self-center"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
