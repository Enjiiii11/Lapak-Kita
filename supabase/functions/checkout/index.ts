import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UNIT_RATE_IDR = 2000;
const WEIGHT_RATE_IDR_PER_KG = 5000;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 999;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestedItem = { product_id: string; quantity: number };

type ProductRow = {
  id: string;
  seller_id: string | null;
  name: string;
  price_idr: number;
  stock: number;
  weight_kg: number;
};

type MeterLine = {
  metric: "units" | "weight_kg";
  quantity: number;
  unit_rate_idr: number;
  cost_idr: number;
};

type QuoteLine = {
  product_id: string;
  product_name: string;
  unit_price_idr: number;
  quantity: number;
  line_total_idr: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseItems(raw: unknown): RequestedItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return null;
  const seen = new Set<string>();
  const items: RequestedItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const { product_id, quantity } = entry as Record<string, unknown>;
    if (typeof product_id !== "string" || !UUID_PATTERN.test(product_id)) return null;
    if (typeof quantity !== "number" || !Number.isInteger(quantity)) return null;
    if (quantity < 1 || quantity > MAX_QUANTITY) return null;
    if (seen.has(product_id)) return null;
    seen.add(product_id);
    items.push({ product_id, quantity });
  }
  return items;
}

function buildQuote(items: RequestedItem[], products: ProductRow[], buyerId: string) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: QuoteLine[] = [];
  let units = 0;
  let weightKg = 0;
  let subtotal = 0;

  for (const item of items) {
    const product = byId.get(item.product_id);
    if (!product) return { error: "A product in your cart no longer exists." };
    if (product.seller_id === buyerId) {
      return { error: `You cannot buy your own product: ${product.name}.` };
    }
    if (product.stock < item.quantity) {
      return { error: `Not enough stock for ${product.name}. Only ${product.stock} left.` };
    }

    const lineTotal = product.price_idr * item.quantity;
    lines.push({
      product_id: product.id,
      product_name: product.name,
      unit_price_idr: product.price_idr,
      quantity: item.quantity,
      line_total_idr: lineTotal,
    });
    units += item.quantity;
    weightKg += product.weight_kg * item.quantity;
    subtotal += lineTotal;
  }

  const roundedWeight = Math.round(weightKg * 100) / 100;
  const meters: MeterLine[] = [
    {
      metric: "units",
      quantity: units,
      unit_rate_idr: UNIT_RATE_IDR,
      cost_idr: units * UNIT_RATE_IDR,
    },
    {
      metric: "weight_kg",
      quantity: roundedWeight,
      unit_rate_idr: WEIGHT_RATE_IDR_PER_KG,
      cost_idr: Math.round(roundedWeight * WEIGHT_RATE_IDR_PER_KG),
    },
  ];
  const usageTotal = meters.reduce((sum, m) => sum + m.cost_idr, 0);

  return {
    lines,
    meters,
    subtotal_idr: subtotal,
    usage_cost_idr: usageTotal,
    total_idr: subtotal + usageTotal,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Please sign in to continue." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }
    const buyerId = userData.user.id;

    const body = await req.json().catch(() => null);
    const items = parseItems(body?.items);
    if (!items) {
      return json(
        { error: "Send 1 to 50 unique items, each with a product_id and a whole-number quantity from 1 to 999." },
        400,
      );
    }
    const dryRun = body?.dry_run === true;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: products, error: productError } = await admin
      .from("products")
      .select("id, seller_id, name, price_idr, stock, weight_kg")
      .in("id", items.map((i) => i.product_id));
    if (productError) throw productError;

    const quote = buildQuote(items, (products ?? []) as ProductRow[], buyerId);
    if ("error" in quote) {
      return json({ error: quote.error }, 422);
    }

    if (dryRun) {
      return json({ dry_run: true, ...quote });
    }

    const { data: orderId, error: orderError } = await admin.rpc("place_order", {
      p_buyer: buyerId,
      p_lines: quote.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      p_meters: quote.meters,
    });
    if (orderError) {
      if (orderError.code === "P0001" || orderError.code === "P0002") {
        return json({ error: orderError.message }, 422);
      }
      throw orderError;
    }

    return json({ dry_run: false, order_id: orderId, ...quote }, 201);
  } catch (err) {
    console.error("checkout failed", err);
    return json({ error: "Checkout could not be completed. Please try again." }, 500);
  }
});
