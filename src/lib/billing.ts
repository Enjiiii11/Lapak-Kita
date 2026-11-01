import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { BillingQuote, CartLine } from '@/types/marketplace';

const FALLBACK_ERROR = 'Something went wrong. Please try again.';

class BillingError extends Error {}

async function invokeCheckout(cartLines: CartLine[], dryRun: boolean): Promise<BillingQuote & { order_id?: string }> {
  const items = cartLines.map((line) => ({ product_id: line.product_id, quantity: line.quantity }));
  const { data, error } = await supabase.functions.invoke('checkout', {
    body: { items, dry_run: dryRun },
  });

  if (error) {
    let message = FALLBACK_ERROR;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body && typeof body.error === 'string') message = body.error;
    }
    throw new BillingError(message);
  }

  if (!data || typeof data.total_idr !== 'number' || !Array.isArray(data.meters)) {
    throw new BillingError(FALLBACK_ERROR);
  }
  return data as BillingQuote & { order_id?: string };
}

export function fetchBillingQuote(cartLines: CartLine[]) {
  return invokeCheckout(cartLines, true);
}

export async function placeOrder(cartLines: CartLine[]) {
  const result = await invokeCheckout(cartLines, false);
  if (typeof result.order_id !== 'string') {
    throw new BillingError(FALLBACK_ERROR);
  }
  return { orderId: result.order_id, quote: result };
}
