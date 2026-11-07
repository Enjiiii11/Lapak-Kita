import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('sends GET requests to the API with same-origin credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest<{ products: unknown[] }>('products')).resolves.toEqual({ products: [] });
    expect(fetchMock).toHaveBeenCalledWith('/api/products', {
      method: 'GET',
      credentials: 'same-origin',
      headers: undefined,
      body: undefined,
    });
  });

  it('serializes request bodies as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('cart', { method: 'POST', body: { product_id: 'p-1', quantity: 2 } });
    expect(fetchMock).toHaveBeenCalledWith('/api/cart', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 'p-1', quantity: 2 }),
    });
  });

  it('uses the API error message for failed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Product is out of stock.' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(apiRequest('checkout')).rejects.toThrow('Product is out of stock.');
  });

  it('uses a fallback message when a failed response has no API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 500 })));

    await expect(apiRequest('checkout')).rejects.toThrow('The request could not be completed. Please try again.');
  });

  it('reports when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));

    await expect(apiRequest('products')).rejects.toThrow(
      'Could not reach the marketplace API. Locally, run npm run vercel:dev; on Vercel, deploy the latest changes.',
    );
  });
});
