import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';

type ApiRequest = {
  method?: string;
  url?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type AppUser = {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
};

type RequestedItem = { product_id: string; quantity: number };
type ProductRow = {
  id: string;
  seller_id: string | null;
  name: string;
  price_idr: number;
  stock: number;
  weight_kg: number;
};

const SESSION_COOKIE = 'lapak_session';
const SESSION_DAYS = 30;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 999;
const UNIT_RATE_IDR = 2000;
const WEIGHT_RATE_IDR_PER_KG = 5000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const MAX_WEIGHT_KG = 10000;
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Beauty', 'Food'];

class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

let database: NeonQueryFunction<false, false> | undefined;

function getDatabase(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new ApiError('Database is not configured. Connect Neon and set DATABASE_URL in Vercel.', 503);
  }
  database ??= neon<false, false>(connectionString);
  return database;
}

function header(req: ApiRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function send(res: ApiResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function fail(res: ApiResponse, error: unknown) {
  if (error instanceof ApiError) {
    send(res, error.statusCode, { error: error.message });
    return;
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P0001' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    send(res, 422, { error: error.message });
    return;
  }
  console.error('Marketplace API request failed', error);
  send(res, 500, { error: 'The request could not be completed. Please try again.' });
}

function getBody(req: ApiRequest): Record<string, unknown> {
  if (typeof req.body === 'string') {
    try {
      const body: unknown = JSON.parse(req.body);
      if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
    } catch {
      throw new ApiError('Request body must be valid JSON.', 400);
    }
  } else if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  throw new ApiError('A JSON request body is required.', 400);
}

function parseItems(raw: unknown): RequestedItem[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
    throw new ApiError(`Send between 1 and ${MAX_ITEMS} unique cart items.`, 400);
  }
  const seen = new Set<string>();
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new ApiError('Invalid cart item.', 400);
    const item = entry as Record<string, unknown>;
    if (typeof item.product_id !== 'string' || !UUID_PATTERN.test(item.product_id)) {
      throw new ApiError('Invalid product in cart.', 400);
    }
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new ApiError(`Quantity must be between 1 and ${MAX_QUANTITY}.`, 400);
    }
    if (seen.has(item.product_id)) throw new ApiError('Duplicate products are not allowed in a cart request.', 400);
    seen.add(item.product_id);
    return { product_id: item.product_id, quantity: item.quantity };
  });
}

function parseProductBody(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = body.category;
  const price = body.price_idr;
  const stock = body.stock;
  const weight = body.weight_kg;
  const imageUrl = body.image_url === null ? null : typeof body.image_url === 'string' ? body.image_url.trim() : null;

  if (!name || name.length > 200) throw new ApiError('Product name must be between 1 and 200 characters.', 400);
  if (description.length > 2000) throw new ApiError('Description must be 2000 characters or fewer.', 400);
  if (typeof category !== 'string' || !CATEGORIES.includes(category)) throw new ApiError('Choose a valid product category.', 400);
  if (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0 || price > 1_000_000_000) {
    throw new ApiError('Price must be a whole number of rupiah.', 400);
  }
  if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
    throw new ApiError('Stock must be a whole number from 0 to 1,000,000.', 400);
  }
  if (
    typeof weight !== 'number' ||
    !Number.isFinite(weight) ||
    weight <= 0 ||
    weight > MAX_WEIGHT_KG ||
    Math.round(weight * 100) !== weight * 100
  ) {
    throw new ApiError(`Weight must be above zero and no more than ${MAX_WEIGHT_KG} kg, with at most two decimal places.`, 400);
  }
  if (imageUrl !== null && (!imageUrl.startsWith('https://') || imageUrl.length > 2048)) {
    throw new ApiError('Image link must be a valid HTTPS URL.', 400);
  }
  return { name, description, category, price, stock, weight, imageUrl };
}

function cookieToken(req: ApiRequest): string | null {
  const cookie = header(req, 'cookie');
  if (!cookie) return null;
  const value = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = value?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function sessionCookie(token: string, secure: boolean) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(res: ApiResponse, secure: boolean) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`);
}

function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function passwordHash(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex || !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

function checkOrigin(req: ApiRequest) {
  const origin = header(req, 'origin');
  const host = header(req, 'x-forwarded-host') ?? header(req, 'host');
  if (!origin || !host) return;
  try {
    if (new URL(origin).host !== host) throw new ApiError('Request origin is not allowed.', 403);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Invalid request origin.', 403);
  }
}

async function getUser(req: ApiRequest): Promise<AppUser | null> {
  const token = cookieToken(req);
  if (!token) return null;
  const rows = await getDatabase()`
    SELECT u.id, u.email, u.full_name, u.is_admin
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenDigest(token)} AND s.expires_at > now()
    LIMIT 1
  `;
  return (rows[0] as AppUser | undefined) ?? null;
}

async function requireUser(req: ApiRequest): Promise<AppUser> {
  const user = await getUser(req);
  if (!user) throw new ApiError('Please sign in to continue.', 401);
  return user;
}

async function createSession(userId: string, req: ApiRequest, res: ApiResponse) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await getDatabase()`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${tokenDigest(token)}, ${userId}, ${expiresAt.toISOString()})
  `;
  const secure = header(req, 'x-forwarded-proto') === 'https';
  res.setHeader('Set-Cookie', sessionCookie(token, secure));
}

async function enforceAuthRateLimit(req: ApiRequest, email: string) {
  const ip = (header(req, 'x-vercel-forwarded-for') ?? header(req, 'x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const bucketHash = createHash('sha256').update(`${email}:${ip}`).digest('hex');
  const rows = await getDatabase()`
    INSERT INTO auth_rate_limits (bucket_hash, attempts, window_started_at)
    VALUES (${bucketHash}, 1, now())
    ON CONFLICT (bucket_hash) DO UPDATE
    SET attempts = CASE
      WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1
      ELSE auth_rate_limits.attempts + 1
    END,
    window_started_at = CASE
      WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now()
      ELSE auth_rate_limits.window_started_at
    END
    RETURNING attempts
  `;
  const attempts = Number((rows[0] as { attempts: number }).attempts);
  if (attempts > 10) throw new ApiError('Too many sign-in attempts. Please wait 15 minutes and try again.', 429);
}

function mapProduct(row: Record<string, unknown>) {
  return {
    ...row,
    price_idr: Number(row.price_idr),
    stock: Number(row.stock),
    weight_kg: Number(row.weight_kg),
  };
}

async function buildQuote(items: RequestedItem[], buyerId: string) {
  const ids = items.map((item) => item.product_id);
  const rows = (await getDatabase()`
    SELECT id, seller_id, name, price_idr, stock, weight_kg
    FROM products WHERE id = ANY(${ids}::uuid[])
  `) as ProductRow[];
  const byId = new Map(rows.map((product) => [product.id, product]));
  const lines = [];
  let units = 0;
  let weightKg = 0;
  let subtotal = 0;

  for (const item of items) {
    const product = byId.get(item.product_id);
    if (!product) throw new ApiError('A product in your cart no longer exists.', 422);
    if (product.seller_id === buyerId) throw new ApiError(`You cannot buy your own product: ${product.name}.`, 422);
    if (Number(product.stock) < item.quantity) {
      throw new ApiError(`Not enough stock for ${product.name}. Only ${product.stock} left.`, 422);
    }
    const lineTotal = Number(product.price_idr) * item.quantity;
    lines.push({
      product_id: product.id,
      product_name: product.name,
      unit_price_idr: Number(product.price_idr),
      quantity: item.quantity,
      line_total_idr: lineTotal,
    });
    units += item.quantity;
    weightKg += Number(product.weight_kg) * item.quantity;
    subtotal += lineTotal;
  }

  const roundedWeight = Math.round(weightKg * 100) / 100;
  const meters = [
    { metric: 'units', quantity: units, unit_rate_idr: UNIT_RATE_IDR, cost_idr: units * UNIT_RATE_IDR },
    {
      metric: 'weight_kg',
      quantity: roundedWeight,
      unit_rate_idr: WEIGHT_RATE_IDR_PER_KG,
      cost_idr: Math.round(roundedWeight * WEIGHT_RATE_IDR_PER_KG),
    },
  ];
  const usageCost = meters.reduce((total, meter) => total + meter.cost_idr, 0);
  return { lines, meters, subtotal_idr: subtotal, usage_cost_idr: usageCost, total_idr: subtotal + usageCost };
}

function parseRoute(req: ApiRequest) {
  const url = new URL(req.url ?? '/', 'https://vercel.local');
  const rewrittenRoute = url.searchParams.get('route');
  return (rewrittenRoute ?? url.pathname.replace(/^\/api\/?/, '')).split('/').filter(Boolean);
}

async function handleAuth(
  req: ApiRequest,
  res: ApiResponse,
  action: string,
  secure: boolean,
) {
  const sql = getDatabase();

  if (action === 'session' && req.method === 'GET') {
    return send(res, 200, { user: await getUser(req) });
  }
  if (action === 'signout' && req.method === 'POST') {
    const token = cookieToken(req);
    if (token) await sql`DELETE FROM sessions WHERE token_hash = ${tokenDigest(token)}`;
    clearSessionCookie(res, secure);
    return send(res, 200, { ok: true });
  }
  if ((action === 'signup' || action === 'signin') && req.method === 'POST') {
    const body = getBody(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError('Enter a valid email address.', 400);
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      throw new ApiError(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`, 400);
    }
    await enforceAuthRateLimit(req, email);

    let rows: Record<string, unknown>[];
    if (action === 'signup') {
      const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
      if (!fullName || fullName.length > 120) throw new ApiError('Name must be between 1 and 120 characters.', 400);
      try {
        rows = (await sql`
          INSERT INTO users (email, full_name, password_hash)
          VALUES (${email}, ${fullName}, ${passwordHash(password)})
          RETURNING id, email, full_name, is_admin
        `) as Record<string, unknown>[];
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          throw new ApiError('An account with this email already exists. Try signing in.', 409);
        }
        throw error;
      }
    } else {
      rows = (await sql`
        SELECT id, email, full_name, is_admin, password_hash
        FROM users WHERE email = ${email} LIMIT 1
      `) as Record<string, unknown>[];
      const row = rows[0];
      if (!row || typeof row.password_hash !== 'string' || !verifyPassword(password, row.password_hash)) {
        throw new ApiError('Email or password is incorrect.', 401);
      }
    }

    const row = rows[0];
    if (!row) throw new ApiError('Authentication could not be completed. Please try again.', 500);
    const user: AppUser = {
      id: String(row.id),
      email: String(row.email),
      full_name: String(row.full_name),
      is_admin: row.is_admin === true,
    };
    await createSession(user.id, req, res);
    return send(res, action === 'signup' ? 201 : 200, { user });
  }
  if (action === 'forgot' && req.method === 'POST') {
    throw new ApiError('Password reset email is not configured yet. Contact the marketplace administrator.', 501);
  }
  throw new ApiError('Not found.', 404);
}

async function handleCart(req: ApiRequest, user: AppUser, route: string[]) {
  const sql = getDatabase();
  if (route.length === 0 && req.method === 'GET') {
    const rows = await sql`
      SELECT c.id, c.product_id, c.quantity,
        json_build_object(
          'id', p.id, 'seller_id', p.seller_id, 'name', p.name, 'description', p.description,
          'category', p.category, 'price_idr', p.price_idr, 'stock', p.stock,
          'weight_kg', p.weight_kg, 'image_url', p.image_url, 'created_at', p.created_at
        ) AS product
      FROM cart_items c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = ${user.id}
      ORDER BY c.created_at ASC
    `;
    return rows.map((row) => {
      const item = row as Record<string, unknown>;
      return { ...item, quantity: Number(item.quantity), product: mapProduct(item.product as Record<string, unknown>) };
    });
  }
  if (route.length === 0 && req.method === 'POST') {
    const body = getBody(req);
    if (typeof body.product_id !== 'string' || !UUID_PATTERN.test(body.product_id)) {
      throw new ApiError('Choose a valid product.', 400);
    }
    if (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > MAX_QUANTITY) {
      throw new ApiError('Quantity must be a whole number from 1 to 999.', 400);
    }
    const products = await sql`SELECT seller_id, stock FROM products WHERE id = ${body.product_id}::uuid LIMIT 1`;
    const product = products[0] as { seller_id: string | null; stock: number } | undefined;
    if (!product) throw new ApiError('Product not found.', 404);
    if (product.seller_id === user.id) throw new ApiError('You cannot add your own product to your cart.', 422);
    if (Number(product.stock) < 1) throw new ApiError('This product is sold out.', 422);
    await sql`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (${user.id}, ${body.product_id}::uuid, ${Math.min(body.quantity, Number(product.stock))})
      ON CONFLICT (user_id, product_id) DO UPDATE
      SET quantity = LEAST(999, cart_items.quantity + EXCLUDED.quantity,
        (SELECT stock FROM products WHERE id = EXCLUDED.product_id))
    `;
    return { ok: true };
  }
  if (route.length === 1 && UUID_PATTERN.test(route[0])) {
    if (req.method === 'PATCH') {
      const body = getBody(req);
      if (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > MAX_QUANTITY) {
        throw new ApiError('Quantity must be a whole number from 1 to 999.', 400);
      }
      const rows = await sql`
        UPDATE cart_items c SET quantity = LEAST(${body.quantity}, p.stock)
        FROM products p
        WHERE c.id = ${route[0]}::uuid AND c.user_id = ${user.id} AND p.id = c.product_id AND p.stock >= 1
        RETURNING c.id
      `;
      if (!rows.length) throw new ApiError('Cart item is no longer available.', 422);
      return { ok: true };
    }
    if (req.method === 'DELETE') {
      await sql`DELETE FROM cart_items WHERE id = ${route[0]}::uuid AND user_id = ${user.id}`;
      return { ok: true };
    }
  }
  throw new ApiError('Not found.', 404);
}

async function handleRequest(req: ApiRequest, res: ApiResponse) {
  const segments = parseRoute(req);
  const [area, action, id] = segments;
  const method = req.method ?? 'GET';
  const secure = header(req, 'x-forwarded-proto') === 'https';

  if (!area) throw new ApiError('Not found.', 404);
  if (method !== 'GET' && method !== 'HEAD') checkOrigin(req);

  if (area === 'auth') return handleAuth(req, res, action ?? '', secure);

  if (area === 'products' && method === 'GET') {
    const rows = await getDatabase()`
      SELECT id, seller_id, name, description, category, price_idr, stock, weight_kg, image_url, created_at
      FROM products ORDER BY created_at DESC
    `;
    return rows.map((row) => mapProduct(row as Record<string, unknown>));
  }

  if (area === 'seller' && action === 'products' && method === 'GET') {
    const user = await requireUser(req);
    const rows = await getDatabase()`
      SELECT id, seller_id, name, description, category, price_idr, stock, weight_kg, image_url, created_at
      FROM products WHERE seller_id = ${user.id} ORDER BY created_at DESC
    `;
    return rows.map((row) => mapProduct(row as Record<string, unknown>));
  }

  if (area === 'products' && method === 'POST') {
    const user = await requireUser(req);
    const product = parseProductBody(getBody(req));
    const rows = await getDatabase()`
      INSERT INTO products (seller_id, name, description, category, price_idr, stock, weight_kg, image_url)
      VALUES (${user.id}, ${product.name}, ${product.description}, ${product.category}, ${product.price},
        ${product.stock}, ${product.weight}, ${product.imageUrl})
      RETURNING id, seller_id, name, description, category, price_idr, stock, weight_kg, image_url, created_at
    `;
    return send(res, 201, mapProduct(rows[0] as Record<string, unknown>));
  }

  if (area === 'products' && id && UUID_PATTERN.test(id)) {
    if (method === 'PATCH') {
      const user = await requireUser(req);
      const product = parseProductBody(getBody(req));
      const rows = await getDatabase()`
        UPDATE products
        SET name = ${product.name}, description = ${product.description}, category = ${product.category},
          price_idr = ${product.price}, stock = ${product.stock}, weight_kg = ${product.weight},
          image_url = ${product.imageUrl}, updated_at = now()
        WHERE id = ${id}::uuid AND seller_id = ${user.id}
        RETURNING id, seller_id, name, description, category, price_idr, stock, weight_kg, image_url, created_at
      `;
      if (!rows.length) throw new ApiError('Product not found or you do not own this listing.', 404);
      return mapProduct(rows[0] as Record<string, unknown>);
    }
    if (method === 'DELETE') {
      const user = await requireUser(req);
      const rows = user.is_admin
        ? await getDatabase()`DELETE FROM products WHERE id = ${id}::uuid RETURNING id`
        : await getDatabase()`DELETE FROM products WHERE id = ${id}::uuid AND seller_id = ${user.id} RETURNING id`;
      if (!rows.length) throw new ApiError('Product not found or you do not have permission to delete it.', 404);
      return { ok: true };
    }
  }

  if (area === 'cart') return handleCart(req, await requireUser(req), segments.slice(1));

  if (area === 'checkout' && method === 'POST') {
    const user = await requireUser(req);
    const body = getBody(req);
    const items = parseItems(body.items);
    const quote = await buildQuote(items, user.id);
    if (body.dry_run === true) return { dry_run: true, ...quote };

    const sql = getDatabase();
    const orderRows = await sql`
      SELECT place_order(${user.id}::uuid, ${JSON.stringify(items)}::jsonb, ${JSON.stringify(quote.meters)}::jsonb) AS order_id
    `;
    const orderId = (orderRows[0] as { order_id: string }).order_id;
    const orderRowsWithDetails = await sql`
      SELECT o.total_idr,
        (SELECT COALESCE(json_agg(json_build_object(
          'product_id', oi.product_id, 'product_name', oi.product_name,
          'unit_price_idr', oi.unit_price_idr, 'quantity', oi.quantity, 'line_total_idr', oi.line_total_idr
        )), '[]'::json) FROM order_items oi WHERE oi.order_id = o.id) AS order_items,
        (SELECT COALESCE(json_agg(json_build_object(
          'metric', m.metric, 'quantity', m.quantity, 'unit_rate_idr', m.unit_rate_idr, 'cost_idr', m.cost_idr
        )), '[]'::json) FROM usage_meters m WHERE m.order_id = o.id) AS usage_meters
      FROM orders o WHERE o.id = ${orderId}::uuid AND o.buyer_id = ${user.id}
    `;
    const details = orderRowsWithDetails[0] as {
      total_idr: number;
      order_items: typeof quote.lines;
      usage_meters: typeof quote.meters;
    };
    const lines = details.order_items.map((line) => ({
      ...line,
      unit_price_idr: Number(line.unit_price_idr),
      quantity: Number(line.quantity),
      line_total_idr: Number(line.line_total_idr),
    }));
    const meters = details.usage_meters.map((meter) => ({
      ...meter,
      quantity: Number(meter.quantity),
      unit_rate_idr: Number(meter.unit_rate_idr),
      cost_idr: Number(meter.cost_idr),
    }));
    const subtotal = lines.reduce((sum, line) => sum + line.line_total_idr, 0);
    return send(res, 201, {
      dry_run: false,
      order_id: orderId,
      lines,
      meters,
      subtotal_idr: subtotal,
      usage_cost_idr: meters.reduce((sum, meter) => sum + meter.cost_idr, 0),
      total_idr: Number(details.total_idr),
    });
  }

  if (area === 'orders' && method === 'GET') {
    const user = await requireUser(req);
    const rows = await getDatabase()`
      SELECT o.id, o.status, o.total_idr, o.created_at,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', oi.id, 'product_id', oi.product_id, 'product_name', oi.product_name,
          'unit_price_idr', oi.unit_price_idr, 'quantity', oi.quantity, 'line_total_idr', oi.line_total_idr
        )), '[]'::json) FROM order_items oi WHERE oi.order_id = o.id) AS order_items,
        (SELECT COALESCE(json_agg(json_build_object(
          'metric', m.metric, 'quantity', m.quantity, 'unit_rate_idr', m.unit_rate_idr, 'cost_idr', m.cost_idr
        )), '[]'::json) FROM usage_meters m WHERE m.order_id = o.id) AS usage_meters
      FROM orders o WHERE o.buyer_id = ${user.id} ORDER BY o.created_at DESC
    `;
    return rows.map((row) => {
      const order = row as Record<string, unknown>;
      const orderItems = order.order_items as Array<Record<string, unknown>>;
      const meters = order.usage_meters as Array<Record<string, unknown>>;
      return {
        ...order,
        total_idr: Number(order.total_idr),
        order_items: orderItems.map((item) => ({
          ...item,
          unit_price_idr: Number(item.unit_price_idr),
          quantity: Number(item.quantity),
          line_total_idr: Number(item.line_total_idr),
        })),
        usage_meters: meters.map((meter) => ({
          ...meter,
          quantity: Number(meter.quantity),
          unit_rate_idr: Number(meter.unit_rate_idr),
          cost_idr: Number(meter.cost_idr),
        })),
      };
    });
  }

  if (area === 'cart-count' && method === 'GET') {
    const user = await requireUser(req);
    const rows = await getDatabase()`
      SELECT COALESCE(SUM(quantity), 0)::integer AS count FROM cart_items WHERE user_id = ${user.id}
    `;
    return { count: Number((rows[0] as { count: number }).count) };
  }

  throw new ApiError('Not found.', 404);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const result = await handleRequest(req, res);
    if (result !== undefined) send(res, 200, result);
  } catch (error) {
    fail(res, error);
  }
}
