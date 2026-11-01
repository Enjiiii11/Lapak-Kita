-- Neon Postgres schema for Lapak Kita.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  password_hash text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_hash text PRIMARY KEY,
  attempts integer NOT NULL,
  window_started_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window ON auth_rate_limits(window_started_at);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  category text NOT NULL CHECK (category IN ('Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Beauty', 'Food')),
  price_idr bigint NOT NULL CHECK (price_idr >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  weight_kg numeric(8,2) NOT NULL DEFAULT 1 CHECK (weight_kg > 0 AND weight_kg <= 10000),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid')),
  total_idr bigint NOT NULL DEFAULT 0 CHECK (total_idr >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES users(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price_idr bigint NOT NULL CHECK (unit_price_idr >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_idr bigint NOT NULL CHECK (line_total_idr >= 0)
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

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_usage_meters_order ON usage_meters(order_id);

CREATE OR REPLACE FUNCTION place_order(p_buyer uuid, p_lines jsonb, p_meters jsonb)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_line jsonb;
  v_meter jsonb;
  v_product products%ROWTYPE;
  v_quantity integer;
  v_subtotal bigint := 0;
  v_meter_total bigint := 0;
BEGIN
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;

  INSERT INTO orders (buyer_id, status, total_idr)
  VALUES (p_buyer, 'paid', 0)
  RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT entry.value
    FROM jsonb_array_elements(p_lines) AS entry(value)
    ORDER BY entry.value->>'product_id'
  LOOP
    v_quantity := (v_line->>'quantity')::integer;

    SELECT * INTO v_product
    FROM products
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
    DELETE FROM cart_items WHERE user_id = p_buyer AND product_id = v_product.id;
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
