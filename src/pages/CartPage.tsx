import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import BillingSummary from '@/components/BillingSummary';
import { fetchBillingQuote, placeOrder } from '@/lib/billing';
import { formatRupiah } from '@/lib/format';
import { apiRequest } from '@/lib/api';
import type { BillingQuote, CartLine } from '@/types/marketplace';

const MAX_QUANTITY = 999;

type CartPageProps = {
  onCartChange: () => void;
  onGoToOrders: () => void;
  onGoToShop: () => void;
};

type PlacedOrder = { orderId: string; totalIdr: number };

export default function CartPage({ onCartChange, onGoToOrders, onGoToShop }: CartPageProps) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiRequest<CartLine[]>('cart');
      setLines(data);
      setLoading(false);
    } catch {
      setLoadError('We could not load your cart. Please try again.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    if (lines.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let active = true;
    setQuoteLoading(true);
    setQuoteError(null);
    fetchBillingQuote(lines)
      .then((result) => {
        if (!active) return;
        setQuote(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setQuote(null);
        setQuoteError(err instanceof Error ? err.message : 'Could not calculate your total.');
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lines]);

  const changeQuantity = async (line: CartLine, nextQuantity: number) => {
    const capped = Math.min(Math.max(nextQuantity, 1), Math.min(line.product.stock, MAX_QUANTITY));
    if (capped === line.quantity) return;

    setActionError(null);
    try {
      await apiRequest(`cart/${line.id}`, { method: 'PATCH', body: { quantity: capped } });
    } catch {
      setActionError('Could not update the quantity. Please try again.');
      return;
    }
    setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, quantity: capped } : l)));
    onCartChange();
  };

  const removeLine = async (line: CartLine) => {
    setActionError(null);
    try {
      await apiRequest(`cart/${line.id}`, { method: 'DELETE' });
    } catch {
      setActionError('Could not remove this item. Please try again.');
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== line.id));
    onCartChange();
  };

  const checkout = async () => {
    setCheckingOut(true);
    setActionError(null);
    try {
      const { orderId, quote: placedQuote } = await placeOrder(lines);
      setPlaced({ orderId, totalIdr: placedQuote.total_idr });
      setQuote(null);
      await loadCart();
      onCartChange();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      void loadCart();
    } finally {
      setCheckingOut(false);
    }
  };

  if (placed) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-stone-900">Order placed</h1>
        <p className="mt-2 text-stone-600">
          Your simulated payment of <span className="font-semibold text-stone-900">{formatRupiah(placed.totalIdr)}</span>{' '}
          was recorded. Order reference:
        </p>
        <p className="mt-2 font-mono text-sm text-stone-500">{placed.orderId.slice(0, 8).toUpperCase()}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onGoToOrders}
            className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600"
          >
            View my orders
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaced(null);
              onGoToShop();
            }}
            className="rounded-xl border border-stone-200 px-5 py-3 font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Keep shopping
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Loading your cart...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
        <AlertCircle className="h-8 w-8 text-rose-600" aria-hidden="true" />
        <p className="font-medium text-rose-800">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadCart()}
          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
          <ShoppingCart className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold text-stone-900">Your cart is empty</h1>
        <p className="text-stone-600">Browse the marketplace and add something you like.</p>
        <button
          type="button"
          onClick={onGoToShop}
          className="mt-2 flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Start shopping
        </button>
      </div>
    );
  }

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const hasBlockingIssue = Boolean(quoteError) || !quote || quoteLoading;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-extrabold text-stone-900">Your cart</h1>
          <p className="text-sm text-stone-500">{itemCount} item(s)</p>
        </div>

        {actionError && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {actionError}
          </p>
        )}

        <ul className="space-y-3">
          {lines.map((line) => {
            const maxQuantity = Math.min(line.product.stock, MAX_QUANTITY);
            return (
              <li
                key={line.id}
                className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:h-24 sm:w-24">
                  {line.product.image_url && (
                    <img src={line.product.image_url} alt={line.product.name} className="h-full w-full object-cover" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-stone-900">{line.product.name}</h2>
                      <p className="text-sm text-stone-500">{formatRupiah(line.product.price_idr)} each</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeLine(line)}
                      aria-label={`Remove ${line.product.name}`}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void changeQuantity(line, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        aria-label="Decrease quantity"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-700 transition hover:bg-stone-200 disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center font-semibold text-stone-900">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => void changeQuantity(line, line.quantity + 1)}
                        disabled={line.quantity >= maxQuantity}
                        aria-label="Increase quantity"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-700 transition hover:bg-stone-200 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="font-bold text-stone-900">
                      {formatRupiah(line.product.price_idr * line.quantity)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="h-fit space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
        <h2 className="text-lg font-bold text-stone-900">Order summary</h2>

        {quoteLoading && !quote && (
          <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Calculating usage...
          </div>
        )}

        {quoteError && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {quoteError}
          </p>
        )}

        {quote && (
          <div className={quoteLoading ? 'opacity-60 transition' : 'transition'}>
            <BillingSummary subtotalIdr={quote.subtotal_idr} meters={quote.meters} totalIdr={quote.total_idr} />
          </div>
        )}

        <button
          type="button"
          onClick={() => void checkout()}
          disabled={hasBlockingIssue || checkingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
        >
          {checkingOut && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Place order (simulated)
        </button>
        <p className="text-center text-xs text-stone-500">No real payment is processed in this demo.</p>
      </aside>
    </div>
  );
}
