import { apiRequest } from '@/lib/api';
import type { BillingQuote, CartLine } from '@/types/marketplace';

async function invokeCheckout(cartLines: CartLine[], dryRun: boolean): Promise<BillingQuote & { order_id?: string }> {
  const items = cartLines.map((line) => ({ product_id: line.product_id, quantity: line.quantity }));
  const data = await apiRequest<BillingQuote & { order_id?: string }>('checkout', {
    method: 'POST',
    body: { items, dry_run: dryRun },
  });
  if (typeof data.total_idr !== 'number' || !Array.isArray(data.meters)) {
    throw new Error('The server returned an invalid billing quote.');
  }
  return data;
}

export function fetchBillingQuote(cartLines: CartLine[]) {
  return invokeCheckout(cartLines, true);
}

export async function placeOrder(cartLines: CartLine[]) {
  const result = await invokeCheckout(cartLines, false);
  if (typeof result.order_id !== 'string') {
    throw new Error('The order was created but the server did not return its reference.');
  }
  return { orderId: result.order_id, quote: result };
}
