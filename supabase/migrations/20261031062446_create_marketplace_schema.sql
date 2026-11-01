/*
# Marketplace schema: products, cart, orders, and usage metering

1. New Tables
- `products`: items for sale. Holds name, description, category, price in rupiah, stock, weight in kg, image, and the seller (empty for platform sample items).
- `cart_items`: each signed-in user's cart lines (product and quantity).
- `orders`: one row per completed checkout (simulated payment), with the grand total.
- `order_items`: products bought in an order, with a snapshot of name and price at purchase time.
- `usage_meters`: metered usage per order (units and shipping weight), with the rate and cost applied.

2. Security
- Row level security is enabled on every table.
- `products`: signed-in users can browse the shared catalog; sellers can only create, edit, and delete their own products.
- `cart_items`: owner-only access.
- `orders`, `order_items`, `usage_meters`: buyers can read their own orders; sellers can read the order lines for their products. Clients cannot write these tables directly.
- `place_order` function: creates orders atomically (stock check, stock deduction, order lines, meters, cart cleanup). Only the server-side checkout function can run it.

3. Seed Data
- Eight sample products with no seller so the marketplace is not empty on first load.

4. Notes
- Order status is simulated ("paid") because no real payment system is connected.
- Re-running this migration is safe: all statements are idempotent.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  category text NOT NULL CHECK (category IN ('Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Beauty', 'Food')),
  price_idr integer NOT NULL CHECK (price_idr >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  weight_kg numeric(8,2) NOT NULL DEFAULT 1 CHECK (weight_kg > 0),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 999),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid')),
  total_idr integer NOT NULL DEFAULT 0 CHECK (total_idr >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price_idr integer NOT NULL CHECK (unit_price_idr >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_idr integer NOT NULL CHECK (line_total_idr >= 0)
);

CREATE TABLE IF NOT EXISTS usage_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (metric IN ('units', 'weight_kg')),
  quantity numeric(10,2) NOT NULL CHECK (quantity >= 0),
  unit_rate_idr integer NOT NULL CHECK (unit_rate_idr >= 0),
  cost_idr integer NOT NULL CHECK (cost_idr >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, metric)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items (seller_id);
CREATE INDEX IF NOT EXISTS idx_usage_meters_order ON usage_meters (order_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_meters ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO authenticated;
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON order_items TO authenticated;
GRANT SELECT ON usage_meters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products, cart_items, orders, order_items, usage_meters TO service_role;

DROP POLICY IF EXISTS "authenticated_select_products" ON products;
CREATE POLICY "authenticated_select_products" ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "seller_insert_products" ON products;
CREATE POLICY "seller_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "seller_update_products" ON products;
CREATE POLICY "seller_update_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "seller_delete_products" ON products;
CREATE POLICY "seller_delete_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "select_own_cart" ON cart_items;
CREATE POLICY "select_own_cart" ON cart_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cart" ON cart_items;
CREATE POLICY "insert_own_cart" ON cart_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cart" ON cart_items;
CREATE POLICY "update_own_cart" ON cart_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cart" ON cart_items;
CREATE POLICY "delete_own_cart" ON cart_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "select_order_items_buyer_or_seller" ON order_items;
CREATE POLICY "select_order_items_buyer_or_seller" ON order_items FOR SELECT
  TO authenticated USING (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.buyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_usage_meters_buyer" ON usage_meters;
CREATE POLICY "select_usage_meters_buyer" ON usage_meters FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = usage_meters.order_id
        AND orders.buyer_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION place_order(p_buyer uuid, p_lines jsonb, p_meters jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_line jsonb;
  v_meter jsonb;
  v_product products%ROWTYPE;
  v_quantity integer;
  v_subtotal integer := 0;
  v_meter_total integer := 0;
BEGIN
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;

  INSERT INTO orders (buyer_id, status, total_idr)
  VALUES (p_buyer, 'paid', 0)
  RETURNING id INTO v_order_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_quantity := (v_line->>'quantity')::integer;

    SELECT * INTO v_product FROM products
    WHERE id = (v_line->>'product_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart no longer exists';
    END IF;
    IF v_product.seller_id = p_buyer THEN
      RAISE EXCEPTION 'You cannot buy your own product: %', v_product.name;
    END IF;
    IF v_product.stock < v_quantity THEN
      RAISE EXCEPTION 'Not enough stock for %', v_product.name;
    END IF;

    UPDATE products
    SET stock = stock - v_quantity, updated_at = now()
    WHERE id = v_product.id;

    INSERT INTO order_items (order_id, product_id, seller_id, product_name, unit_price_idr, quantity, line_total_idr)
    VALUES (v_order_id, v_product.id, v_product.seller_id, v_product.name, v_product.price_idr, v_quantity, v_product.price_idr * v_quantity);

    v_subtotal := v_subtotal + v_product.price_idr * v_quantity;

    DELETE FROM cart_items
    WHERE user_id = p_buyer AND product_id = v_product.id;
  END LOOP;

  FOR v_meter IN SELECT value FROM jsonb_array_elements(p_meters) LOOP
    INSERT INTO usage_meters (order_id, metric, quantity, unit_rate_idr, cost_idr)
    VALUES (
      v_order_id,
      v_meter->>'metric',
      (v_meter->>'quantity')::numeric,
      (v_meter->>'unit_rate_idr')::integer,
      (v_meter->>'cost_idr')::integer
    );
    v_meter_total := v_meter_total + (v_meter->>'cost_idr')::integer;
  END LOOP;

  UPDATE orders SET total_idr = v_subtotal + v_meter_total WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION place_order(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION place_order(uuid, jsonb, jsonb) TO service_role;

INSERT INTO products (id, seller_id, name, description, category, price_idr, stock, weight_kg, image_url) VALUES
  ('11111111-0000-4000-8000-000000000001', NULL, 'Wireless Over-Ear Headphones', 'Crisp stereo sound with soft ear cushions and up to 30 hours of battery life.', 'Electronics', 459000, 25, 0.35, 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('11111111-0000-4000-8000-000000000002', NULL, 'Everyday Canvas Sneakers', 'Lightweight low-top sneakers with a cushioned insole for all-day comfort.', 'Fashion', 329000, 40, 0.9, 'https://images.pexels.com/photos/4296075/pexels-photo-4296075.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('11111111-0000-4000-8000-000000000003', NULL, 'Handmade Ceramic Coffee Mug', 'Glazed stoneware mug that holds 350 ml and is safe for the dishwasher.', 'Home', 89000, 60, 0.45, 'https://images.pexels.com/photos/16033792/pexels-photo-16033792.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('11111111-0000-4000-8000-000000000004', NULL, 'Premium Non-Slip Yoga Mat', 'Six millimetre thick mat with a textured surface and carrying strap.', 'Sports', 175000, 30, 1.2, 'https://images.pexels.com/photos/8436580/pexels-photo-8436580.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('11111111-0000-4000-8000-000000000005', NULL, 'Dotted Notebook A5', '160 pages of 120 gsm dotted paper with a hardcover and ribbon bookmark.', 'Books', 65000, 80, 0.3, 'https://images.pexels.com/photos/37793421/pexels-photo-37793421.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('11111111-0000-4000-8000-000000000006', NULL, 'Vitamin C Brightening Serum', 'Lightweight daily serum with 15% vitamin C for a brighter, even complexion.', 'Beauty', 135000, 50, 0.2, 'https://images.pexels.com/photos/39281910/pexels-photo-39281910.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('11111111-0000-4000-8000-000000000007', NULL, 'Single-Origin Coffee Beans 500g', 'Medium-roast Arabica beans with notes of chocolate and caramel.', 'Food', 118000, 45, 0.6, 'https://images.pexels.com/photos/5926957/pexels-photo-5926957.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('11111111-0000-4000-8000-000000000008', NULL, 'Sport Smartwatch', 'Heart-rate and step tracking with a bright display and water resistance.', 'Electronics', 899000, 12, 0.12, 'https://images.pexels.com/photos/11677077/pexels-photo-11677077.jpeg?auto=compress&cs=tinysrgb&h=650&w=940')
ON CONFLICT (id) DO NOTHING;
