import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { upload } from '@vercel/blob/client';
import { ImagePlus, Loader2, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { PRODUCT_CATEGORIES, type Product } from '@/types/marketplace';

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
  if (!Number.isFinite(weight) || weight <= 0 || weight > 10000 || Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-9) {
    return { error: 'Weight must be above zero and no more than 10,000 kg, with at most two decimal places.' };
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = product !== null;

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectImage = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_CONTENT_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setError(null);
    setImageFile(file);
    setForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectImage(event.dataTransfer.files[0]);
  };

  const clearImage = () => {
    setImageFile(null);
    setForm((prev) => ({ ...prev, imageUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    try {
      let imageUrl = result.payload.image_url;
      if (imageFile) {
        if (!user) throw new Error('Please sign in again before uploading an image.');
        setUploadProgress(0);
        const safeFileName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const blob = await upload(`products/${user.id}/${crypto.randomUUID()}-${safeFileName}`, imageFile, {
          access: 'public',
          handleUploadUrl: '/api/blob-upload',
          contentType: imageFile.type,
          onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
        });
        imageUrl = blob.url;
      }
      await apiRequest(product ? `products/${product.id}` : 'products', {
        method: product ? 'PATCH' : 'POST',
        body: { ...result.payload, image_url: imageUrl },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'We could not save this product. Please try again.');
      setSaving(false);
      setUploadProgress(null);
      return;
    }
    setSaving(false);
    setUploadProgress(null);
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
              max={10000}
              step={0.01}
              value={form.weight}
              onChange={(e) => update('weight', e.target.value)}
              placeholder="0.5"
              className={fieldClass}
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Product image (optional)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a product image"
            onChange={(event) => {
              selectImage(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              disabled={saving}
              className={`flex min-h-32 flex-1 items-center justify-center gap-4 rounded-xl border-2 border-dashed p-4 text-left transition ${
                isDragging ? 'border-orange-500 bg-orange-50' : 'border-stone-300 bg-stone-50 hover:border-orange-400'
              } disabled:opacity-70`}
            >
              {(imagePreview || form.imageUrl) ? (
                <img
                  src={imagePreview ?? form.imageUrl}
                  alt="Product preview"
                  className="h-24 w-24 rounded-lg object-cover"
                />
              ) : (
                <ImagePlus className="h-8 w-8 shrink-0 text-orange-500" aria-hidden="true" />
              )}
              <span>
                <span className="block font-medium text-stone-800">
                  {imagePreview || form.imageUrl ? 'Drop to replace image' : 'Drag and drop an image'}
                </span>
                <span className="mt-1 block text-sm text-stone-500">or browse files · JPG, PNG, WebP · up to 5 MB</span>
              </span>
            </button>
            {(imagePreview || form.imageUrl) && (
              <button
                type="button"
                onClick={clearImage}
                disabled={saving}
                aria-label="Remove product image"
                className="rounded-full border border-stone-200 p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-70"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {uploadProgress !== null && (
            <p className="mt-2 text-sm text-stone-600" role="status">
              Uploading image: {uploadProgress}%
            </p>
          )}
        </div>

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
            {uploadProgress !== null ? 'Uploading image...' : isEdit ? 'Save changes' : 'Publish product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
