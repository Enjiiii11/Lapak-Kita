import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PRODUCT_CATEGORIES, type Product } from '@/types/marketplace';

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

type ProductFormModalProps = {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  weight: string;
  imageUrl: string;
};

const fieldClass =
  'w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100';

function toFormState(product: Product | null): FormState {
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? PRODUCT_CATEGORIES[0],
    price: product ? String(product.price_idr) : '',
    stock: product ? String(product.stock) : '',
    weight: product ? String(product.weight_kg) : '1',
    imageUrl: product?.image_url ?? '',
  };
}

function validate(form: FormState): { payload: Omit<Product, 'id' | 'seller_id' | 'created_at'> } | { error: string } {
  const name = form.name.trim();
  const description = form.description.trim();
  const price = Number(form.price);
  const stock = Number(form.stock);
  const weight = Number(form.weight);
  const imageUrl = form.imageUrl.trim();

  if (!name || name.length > NAME_MAX) return { error: `Please enter a product name (up to ${NAME_MAX} characters).` };
  if (description.length > DESCRIPTION_MAX) return { error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` };
  if (!PRODUCT_CATEGORIES.includes(form.category as Product['category'])) return { error: 'Please choose a category.' };
  if (form.price.trim() === '' || !Number.isInteger(price) || price < 0) {
    return { error: 'Price must be a whole number of rupiah, zero or more.' };
  }
  if (form.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) {
    return { error: 'Stock must be a whole number, zero or more.' };
  }
  if (!Number.isFinite(weight) || weight <= 0 || Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-9) {
    return { error: 'Weight must be above zero, with at most two decimal places.' };
  }
  if (imageUrl && !/^https:\/\/\S+$/i.test(imageUrl)) {
    return { error: 'Image link must start with https://.' };
  }

  return {
    payload: {
      name,
      description,
      category: form.category as Product['category'],
      price_idr: price,
      stock,
      weight_kg: weight,
      image_url: imageUrl || null,
    },
  };
}

export default function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = product !== null;

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const result = validate(form);
    if ('error' in result) {
      setError(result.error);
      return;
    }

    setSaving(true);
    const { error: saveError } = product
      ? await supabase.from('products').update(result.payload).eq('id', product.id)
      : await supabase.from('products').insert({ ...result.payload, seller_id: user?.id });
    setSaving(false);

    if (saveError) {
      setError('We could not save this product. Please try again.');
      return;
    }
    onSaved();
  };

  return (
    <Modal title={isEdit ? 'Edit product' : 'Add a new product'} onClose={onClose} maxWidthClass="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Product name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Bamboo Desk Organizer"
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Tell buyers what makes this product special"
            className={`${fieldClass} resize-none`}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Category</span>
            <select value={form.category} onChange={(e) => update('category', e.target.value)} className={fieldClass}>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Price (Rp)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              placeholder="150000"
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Stock</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.stock}
              onChange={(e) => update('stock', e.target.value)}
              placeholder="20"
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Weight per item (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              value={form.weight}
              onChange={(e) => update('weight', e.target.value)}
              placeholder="0.5"
              className={fieldClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Image link (optional)</span>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => update('imageUrl', e.target.value)}
            placeholder="https://..."
            className={fieldClass}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 px-5 py-2.5 font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isEdit ? 'Save changes' : 'Publish product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
