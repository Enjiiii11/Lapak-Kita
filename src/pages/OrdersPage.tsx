import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, Loader2, ReceiptText } from 'lucide-react';
import BillingSummary from '@/components/BillingSummary';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/types/marketplace';

type LoadState = 'loading' | 'ready' | 'error';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoadState('loading');
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, status, total_idr, created_at, order_items(id, product_id, product_name, unit_price_idr, quantity, line_total_idr), usage_meters(metric, quantity, unit_rate_idr, cost_idr)',
      )
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      setLoadState('error');
      return;
    }
    setOrders(data as unknown as Order[]);
    setLoadState('ready');
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Loading your orders...
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
        <AlertCircle className="h-8 w-8 text-rose-600" aria-hidden="true" />
        <p className="font-medium text-rose-800">We could not load your orders right now.</p>
        <button
          type="button"
          onClick={() => void loadOrders()}
          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
          <ReceiptText className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold text-stone-900">No orders yet</h1>
        <p className="text-stone-600">Once you place an order, it will show up here with its usage breakdown.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-stone-900">My orders</h1>
        <p className="mt-1 text-sm text-stone-500">Each order shows its items and the metered usage behind its total.</p>
      </div>

      <ul className="space-y-4">
        {orders.map((order) => {
          const expanded = expandedId === order.id;
          const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
          const subtotal = order.order_items.reduce((sum, item) => sum + item.line_total_idr, 0);
          return (
            <li key={order.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : order.id)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-stone-50"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-sm font-semibold text-stone-900">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-sm text-stone-500">
                    {formatDateTime(order.created_at)} · {itemCount} item(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-emerald-700">
                      {order.status}
                    </span>
                    <p className="mt-1 font-bold text-stone-900">{formatRupiah(order.total_idr)}</p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-stone-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {expanded && (
                <div className="grid gap-6 border-t border-stone-100 bg-stone-50/50 p-5 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Items</p>
                    <ul className="space-y-3">
                      {order.order_items.map((item) => (
                        <li key={item.id} className="flex justify-between gap-3 text-sm">
                          <span className="min-w-0 text-stone-700">
                            <span className="font-medium text-stone-900">{item.product_name}</span>
                            <span className="block text-xs text-stone-500">
                              {item.quantity} x {formatRupiah(item.unit_price_idr)}
                            </span>
                          </span>
                          <span className="shrink-0 font-medium text-stone-900">{formatRupiah(item.line_total_idr)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <BillingSummary subtotalIdr={subtotal} meters={order.usage_meters} totalIdr={order.total_idr} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
