import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search, SearchX } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import ProductDetailModal from '@/components/ProductDetailModal';
import { supabase } from '@/lib/supabase';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '@/types/marketplace';

type ShopPageProps = {
  onCartChange: () => void;
  onGoToCart: () => void;
};

type LoadState = 'loading' | 'ready' | 'error';

const ALL_CATEGORIES = 'All' as const;

export default function ShopPage({ onCartChange, onGoToCart }: ShopPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory | typeof ALL_CATEGORIES>(ALL_CATEGORIES);
  const [selected, setSelected] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadState('loading');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      setLoadState('error');
      return;
    }
    setProducts(data as Product[]);
    setLoadState('ready');
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== ALL_CATEGORIES && product.category !== category) return false;
      if (!term) return true;
      return product.name.toLowerCase().includes(term) || product.description.toLowerCase().includes(term);
    });
  }, [products, query, category]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-stone-900 text-white">
        <img
          src="https://images.pexels.com/photos/5699374/pexels-photo-5699374.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-900 via-stone-900/80 to-stone-900/20" />
        <div className="relative max-w-xl p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-300">Lapak Kita Marketplace</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Find something you love today</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-200">
            Fresh arrivals from independent sellers, with transparent billing on every order.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <span className="sr-only">Search products</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
          {[ALL_CATEGORIES, ...PRODUCT_CATEGORIES].map((item) => {
            const active = category === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={active}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {loadState === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-24 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading products...
        </div>
      )}

      {loadState === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-rose-600" aria-hidden="true" />
          <p className="font-medium text-rose-800">We could not load the products right now.</p>
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
        <div className="flex flex-col items-center gap-3 py-20 text-center text-stone-500">
          <SearchX className="h-10 w-10 text-stone-400" aria-hidden="true" />
          <p className="font-medium text-stone-700">No products match your search.</p>
          <p className="text-sm">Try a different keyword or category.</p>
        </div>
      )}

      {loadState === 'ready' && visibleProducts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <ProductDetailModal
          product={selected}
          onClose={() => setSelected(null)}
          onCartChange={onCartChange}
          onGoToCart={() => {
            setSelected(null);
            onGoToCart();
          }}
        />
      )}
    </div>
  );
}
