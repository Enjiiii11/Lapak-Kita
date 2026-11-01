export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home',
  'Sports',
  'Books',
  'Beauty',
  'Food',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type View = 'shop' | 'cart' | 'orders' | 'selling' | 'admin';

export type Product = {
  id: string;
  seller_id: string | null;
  name: string;
  description: string;
  category: ProductCategory;
  price_idr: number;
  stock: number;
  weight_kg: number;
  image_url: string | null;
  created_at: string;
};

export type CartLine = {
  id: string;
  product_id: string;
  quantity: number;
  product: Product;
};

export type UsageMeter = {
  metric: 'units' | 'weight_kg';
  quantity: number;
  unit_rate_idr: number;
  cost_idr: number;
};

export type QuoteLine = {
  product_id: string;
  product_name: string;
  unit_price_idr: number;
  quantity: number;
  line_total_idr: number;
};

export type BillingQuote = {
  lines: QuoteLine[];
  meters: UsageMeter[];
  subtotal_idr: number;
  usage_cost_idr: number;
  total_idr: number;
};

export type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price_idr: number;
  quantity: number;
  line_total_idr: number;
};

export type Order = {
  id: string;
  status: string;
  total_idr: number;
  created_at: string;
  order_items: OrderItem[];
  usage_meters: UsageMeter[];
};
