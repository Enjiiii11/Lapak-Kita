import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import { fetchBillingQuote, placeOrder } from '@/lib/billing';
import type { BillingQuote, CartLine } from '@/types/marketplace';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const cartLines = [
  { product_id: 'product-1', quantity: 2 },
  { product_id: 'product-2', quantity: 1 },
] as CartLine[];

const quote: BillingQuote = {
  lines: [],
  meters: [],
  subtotal_idr: 10000,
  usage_cost_idr: 6000,
  total_idr: 16000,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('billing requests', () => {
  it('requests a dry-run quote without placing an order', async () => {
    vi.mocked(apiRequest).mockResolvedValue(quote);

    await expect(fetchBillingQuote(cartLines)).resolves.toEqual(quote);
    expect(apiRequest).toHaveBeenCalledWith('checkout', {
      method: 'POST',
      body: {
        items: [
          { product_id: 'product-1', quantity: 2 },
          { product_id: 'product-2', quantity: 1 },
        ],
        dry_run: true,
      },
    });
  });

  it('places an order and returns its reference and quote', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...quote, order_id: 'order-123' });

    await expect(placeOrder(cartLines)).resolves.toEqual({
      orderId: 'order-123',
      quote: { ...quote, order_id: 'order-123' },
    });
    expect(apiRequest).toHaveBeenCalledWith('checkout', {
      method: 'POST',
      body: {
        items: [
          { product_id: 'product-1', quantity: 2 },
          { product_id: 'product-2', quantity: 1 },
        ],
        dry_run: false,
      },
    });
  });

  it('rejects invalid quote responses', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...quote, total_idr: '16000' });

    await expect(fetchBillingQuote(cartLines)).rejects.toThrow('The server returned an invalid billing quote.');
  });

  it('reports when an order response has no order reference', async () => {
    vi.mocked(apiRequest).mockResolvedValue(quote);

    await expect(placeOrder(cartLines)).rejects.toThrow(
      'The order was created but the server did not return its reference.',
    );
  });
});
