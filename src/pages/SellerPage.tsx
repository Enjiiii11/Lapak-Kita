import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import ProductFormModal from '@/components/ProductFormModal';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah, formatWeight } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/marketplace';

type LoadState = 'loading' | 'ready' | 'error';
type FormMode = { kind: 'create' } | { kind: 'edit'; product: Product } | null;

export default function SellerPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!user) return;
    setLoadState('loading');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      setLoadState('error');
      return;
    }
    setProducts(data as Product[]);
    setLoadState('ready');
  }, [user]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const deleteProduct = async (product: Product) => {
    setDeletingId(product.id);
    setActionError(null);
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    setDeletingId(null);
    setConfirmingId(null);
    if (error) {
      setActionError('We could not delete this product. Please try again.');
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const handleSaved = () => {
    setFormMode(null);
    void loadProducts();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">My listings</h1>
          <p className="mt-1 text-sm text-stone-500">Products you publish appear in the shop for every buyer.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormMode({ kind: 'create' })}
          className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add product
        </button>
      </div>

      {actionError && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {actionError}
        </p>
      )}

      {loadState === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-24 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading your listings...
        </div>
      )}

      {loadState === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-rose-600" aria-hidden="true" />
          <p className="font-medium text-rose-800">We could not load your listings right now.</p>
          <button
            type="button"
            onClick={() => void loadProducts()}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && products.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <Package className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="font-semibold text-stone-900">You have not listed anything yet</p>
          <p className="text-sm text-stone-500">Add your first product and it will appear in the shop.</p>
        </div>
      )}

      {loadState === 'ready' && products.length > 0 && (
        <ul className="space-y-3">
          {products.map((product) => {
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormMode({ kind: 'edit', product })}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-orange-300 hover:text-orange-600"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(product.id)}
                      aria-label={`Delete ${product.name}`}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {formMode && (
        <ProductFormModal
          product={formMode.kind === 'edit' ? formMode.product : null}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
