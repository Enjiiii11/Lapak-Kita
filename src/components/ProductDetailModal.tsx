import { useState } from 'react';
import { CheckCircle2, Loader2, Minus, Plus, Scale, ShoppingCart } from 'lucide-react';
import Modal from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah, formatWeight } from '@/lib/format';
import { apiRequest } from '@/lib/api';
import type { Product } from '@/types/marketplace';

const MAX_QUANTITY = 999;

type ProductDetailModalProps = {
  product: Product;
  onClose: () => void;
  onCartChange: () => void;
  onGoToCart: () => void;
};

export default function ProductDetailModal({ product, onClose, onCartChange, onGoToCart }: ProductDetailModalProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxQuantity = Math.min(product.stock, MAX_QUANTITY);
  const isOwnProduct = product.seller_id !== null && product.seller_id === user?.id;
  const canAdd = product.stock > 0 && !isOwnProduct;

  const changeQuantity = (next: number) => {
    setQuantity(Math.min(Math.max(next, 1), Math.max(maxQuantity, 1)));
    setAdded(false);
  };

  const addToCart = async () => {
    setAdding(true);
    setError(null);
    try {
      await apiRequest('cart', { method: 'POST', body: { product_id: product.id, quantity } });
    } catch {
      setAdding(false);
      setError('Could not add this item to your cart. Please try again.');
      return;
    }

    setAdding(false);
    setAdded(true);
    onCartChange();
  };

  return (
    <Modal title={product.name} onClose={onClose} maxWidthClass="max-w-3xl">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="inline-block rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
              {product.category}
            </span>
            <p className="mt-3 text-3xl font-extrabold text-stone-900">{formatRupiah(product.price_idr)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
              <Scale className="h-4 w-4" aria-hidden="true" />
              {formatWeight(product.weight_kg)} per item
            </p>
          </div>

          <p className="text-sm leading-relaxed text-stone-600">{product.description || 'No description provided.'}</p>

          <p className="text-sm text-stone-500">
            {product.stock > 0 ? `${product.stock} in stock` : 'Currently sold out'}
          </p>

          {canAdd && (
            <div className="flex items-center justify-between rounded-xl border border-stone-200 p-2">
              <span className="pl-2 text-sm font-medium text-stone-700">Quantity</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeQuantity(quantity - 1)}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-700 transition hover:bg-stone-200 disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="w-10 text-center font-semibold text-stone-900" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => changeQuantity(quantity + 1)}
                  disabled={quantity >= maxQuantity}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-700 transition hover:bg-stone-200 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {isOwnProduct && (
            <p className="rounded-xl bg-stone-100 p-3 text-sm text-stone-600">This is your listing, so you cannot buy it.</p>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {added && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Added to your cart
              </span>
              <button type="button" onClick={onGoToCart} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
                View cart
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void addToCart()}
            disabled={!canAdd || adding}
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            )}
            {product.stock === 0 ? 'Sold out' : 'Add to cart'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
