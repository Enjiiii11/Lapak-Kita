import { Package, Scale } from 'lucide-react';
import { formatRupiah, formatWeight } from '@/lib/format';
import type { Product } from '@/types/marketplace';

type ProductCardProps = {
  product: Product;
  onOpen: (product: Product) => void;
};

export default function ProductCard({ product, onOpen }: ProductCardProps) {
  const soldOut = product.stock === 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
    >
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400">
            <Package className="h-12 w-12" aria-hidden="true" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-stone-700 shadow-sm">
          {product.category}
        </span>
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-stone-900/60 text-sm font-semibold text-white">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900 sm:text-base">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="text-base font-bold text-orange-600 sm:text-lg">{formatRupiah(product.price_idr)}</p>
          <p className="flex items-center gap-1 text-xs text-stone-500">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            {formatWeight(product.weight_kg)}
          </p>
        </div>
      </div>
    </button>
  );
}
