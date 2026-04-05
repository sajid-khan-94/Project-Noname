import crypto from "node:crypto";
import {
  cuisines as seededCuisines,
  findCuisineLabel,
  menuItems as seededMenuItems,
} from "../../server/data.js";
import { createPostgresStore } from "./postgres.js";

const orderSteps = ["pending_payment", "payment_authorized", "preparing", "out_for_delivery", "delivered"];

const database = createPostgresStore({
  connectionString: process.env.DATABASE_URL ?? "postgresql://bkfast:bkfast@localhost:5432/finance_db",
  schemaStatements: [
    `CREATE TABLE IF NOT EXISTS cuisines (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE
    )`,
    `CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY,
      cuisine_id TEXT NOT NULL REFERENCES cuisines(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price NUMERIC(12, 2) NOT NULL,
      calories INTEGER NOT NULL,
      prep_time TEXT NOT NULL,
      spice_level TEXT NOT NULL,
      color TEXT NOT NULL,
      popular BOOLEAN NOT NULL DEFAULT FALSE
    )`,
    `CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      discount_percent NUMERIC(5, 2) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS promo_code_cuisines (
      promo_id TEXT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      cuisine_id TEXT NOT NULL REFERENCES cuisines(id) ON DELETE CASCADE,
      PRIMARY KEY (promo_id, cuisine_id)
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      gateway_id TEXT,
      eta_minutes INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL,
      delivery_fee NUMERIC(12, 2) NOT NULL,
      platform_fee NUMERIC(12, 2) NOT NULL,
      total NUMERIC(12, 2) NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      cuisine_id TEXT NOT NULL,
      cuisine_label TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12, 2) NOT NULL,
      line_total NUMERIC(12, 2) NOT NULL
    )`,
  ],
  seed: async (client) => {
    for (const cuisine of seededCuisines) {
      await client.query(
        `INSERT INTO cuisines (id, label, thumbnail, enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [cuisine.id, cuisine.label, cuisine.thumbnail, cuisine.enabled],
      );
    }

    for (const item of seededMenuItems) {
      await client.query(
        `INSERT INTO menu_items (
           id, cuisine_id, name, description, price, calories, prep_time, spice_level, color, popular
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.cuisine,
          item.name,
          item.desc,
          item.price,
          item.cal,
          item.prepTime,
          item.spice,
          item.color,
          item.popular,
        ],
      );
    }
  },
});

function nextStatus(current) {
  const index = orderSteps.indexOf(current);
  return index === -1 || index === orderSteps.length - 1 ? current : orderSteps[index + 1];
}

function mapCuisine(row) {
  return {
    id: row.id,
    label: row.label,
    thumbnail: row.thumbnail,
    enabled: row.enabled,
  };
}

function mapMenuItem(row) {
  return {
    id: Number(row.id),
    cuisine: row.cuisine_id,
    name: row.name,
    desc: row.description,
    price: Number(row.price),
    cal: Number(row.calories),
    prepTime: row.prep_time,
    spice: row.spice_level,
    color: row.color,
    popular: row.popular,
  };
}

function mapOrder(row, items) {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    gatewayId: row.gateway_id,
    etaMinutes: Number(row.eta_minutes),
    createdAt: row.created_at,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    platformFee: Number(row.platform_fee),
    total: Number(row.total),
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.delivery_address,
    },
    items,
  };
}

async function loadOrderItems(client, orderIds) {
  if (!orderIds.length) return new Map();

  const result = await client.query(
    `SELECT order_id, item_id, name, cuisine_id, cuisine_label, quantity, unit_price, line_total
     FROM order_items
     WHERE order_id = ANY($1::text[])
     ORDER BY id ASC`,
    [orderIds],
  );

  const itemMap = new Map();
  for (const row of result.rows) {
    const list = itemMap.get(row.order_id) ?? [];
    list.push({
      itemId: Number(row.item_id),
      name: row.name,
      cuisine: row.cuisine_id,
      cuisineLabel: row.cuisine_label,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      lineTotal: Number(row.line_total),
    });
    itemMap.set(row.order_id, list);
  }

  return itemMap;
}

async function summarizeItems(client, cartItems = []) {
  const itemIds = cartItems.map((entry) => Number(entry.itemId)).filter(Boolean);
  if (!itemIds.length) {
    return { items: [], subtotal: 0, deliveryFee: 0, platformFee: 0, total: 0 };
  }

  const menuResult = await client.query(
    `SELECT id, cuisine_id, name, price FROM menu_items WHERE id = ANY($1::int[])`,
    [itemIds],
  );
  const cuisineResult = await client.query(
    `SELECT id, label FROM cuisines`,
  );

  const itemLookup = new Map(menuResult.rows.map((row) => [Number(row.id), row]));
  const cuisineLabels = new Map(cuisineResult.rows.map((row) => [row.id, row.label]));

  const items = cartItems
    .map((cartItem) => {
      const menuItem = itemLookup.get(Number(cartItem.itemId));
      if (!menuItem) return null;
      const quantity = Math.max(1, Number(cartItem.quantity) || 1);
      return {
        itemId: Number(menuItem.id),
        name: menuItem.name,
        cuisine: menuItem.cuisine_id,
        cuisineLabel: cuisineLabels.get(menuItem.cuisine_id) ?? findCuisineLabel(menuItem.cuisine_id),
        quantity,
        unitPrice: Number(menuItem.price),
        lineTotal: Number(menuItem.price) * quantity,
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = items.length ? 39 : 0;
  const platformFee = items.length ? 12 : 0;

  return {
    items,
    subtotal,
    deliveryFee,
    platformFee,
    total: subtotal + deliveryFee + platformFee,
  };
}

export async function listCuisines({ includeDisabled = false } = {}) {
  const result = await database.query(
    `SELECT id, label, thumbnail, enabled
     FROM cuisines
     ${includeDisabled ? "" : "WHERE enabled = TRUE"}
     ORDER BY CASE WHEN id = 'all' THEN 0 ELSE 1 END, label ASC`,
  );
  return result.rows.map(mapCuisine);
}

export async function upsertCuisine(payload) {
  const id = payload?.id?.trim().toLowerCase();
  const label = payload?.label?.trim();
  const thumbnail =
    payload?.thumbnail?.trim() ||
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80";
  const enabled = payload?.enabled !== false;

  if (!id || !label) {
    throw new Error("Cuisine id and label are required.");
  }

  const result = await database.query(
    `INSERT INTO cuisines (id, label, thumbnail, enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       label = EXCLUDED.label,
       thumbnail = EXCLUDED.thumbnail,
       enabled = EXCLUDED.enabled
     RETURNING id, label, thumbnail, enabled`,
    [id, label, thumbnail, enabled],
  );

  return mapCuisine(result.rows[0]);
}

export async function deleteCuisine(id) {
  if (!id || id === "all") {
    throw new Error("This cuisine cannot be removed.");
  }

  await database.transaction(async (client) => {
    await client.query(`DELETE FROM promo_code_cuisines WHERE cuisine_id = $1`, [id]);
    await client.query(`DELETE FROM menu_items WHERE cuisine_id = $1`, [id]);
    await client.query(`DELETE FROM cuisines WHERE id = $1`, [id]);
  });

  return true;
}

export async function listMenuItems({ cuisine = "all", search = "" } = {}) {
  const params = [];
  const conditions = [`c.enabled = TRUE`];

  if (cuisine && cuisine !== "all") {
    params.push(cuisine);
    conditions.push(`m.cuisine_id = $${params.length}`);
  }

  if (search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    params.push(term);
    conditions.push(
      `(LOWER(m.name) LIKE $${params.length} OR LOWER(m.description) LIKE $${params.length} OR LOWER(m.cuisine_id) LIKE $${params.length})`,
    );
  }

  const result = await database.query(
    `SELECT
       m.id,
       m.cuisine_id,
       m.name,
       m.description,
       m.price,
       m.calories,
       m.prep_time,
       m.spice_level,
       m.color,
       m.popular
     FROM menu_items m
     JOIN cuisines c ON c.id = m.cuisine_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY m.popular DESC, m.price ASC`,
    params,
  );

  return result.rows.map(mapMenuItem);
}

export async function createOrder(payload) {
  const user = payload?.user;
  const customer = payload?.customer;
  const paymentMethod = payload?.paymentMethod?.trim() || "card";

  if (!user?.id) {
    throw new Error("Authenticated user is required.");
  }
  if (!customer?.name?.trim() || !customer?.phone?.trim() || !customer?.address?.trim()) {
    throw new Error("Customer name, phone, and delivery address are required.");
  }

  return database.transaction(async (client) => {
    const summary = await summarizeItems(client, payload?.items ?? []);
    if (!summary.items.length) {
      throw new Error("Order must include at least one valid item.");
    }

    const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;
    const paymentStatus = paymentMethod === "cod" ? "pending" : "authorized";
    const status = paymentMethod === "cod" ? "pending_payment" : "payment_authorized";

    const orderResult = await client.query(
      `INSERT INTO orders (
         id, user_id, status, payment_status, payment_method, gateway_id,
         eta_minutes, created_at, subtotal, delivery_fee, platform_fee, total,
         customer_name, customer_phone, delivery_address
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         28, NOW(), $7, $8, $9, $10,
         $11, $12, $13
       )
       RETURNING *`,
      [
        orderId,
        user.id,
        status,
        paymentStatus,
        paymentMethod,
        payload?.gatewayId?.trim() || null,
        summary.subtotal,
        summary.deliveryFee,
        summary.platformFee,
        summary.total,
        customer.name.trim(),
        customer.phone.trim(),
        customer.address.trim(),
      ],
    );

    for (const item of summary.items) {
      await client.query(
        `INSERT INTO order_items (
           order_id, item_id, name, cuisine_id, cuisine_label, quantity, unit_price, line_total
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orderId,
          item.itemId,
          item.name,
          item.cuisine,
          item.cuisineLabel,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      );
    }

    return mapOrder(orderResult.rows[0], summary.items);
  });
}

export async function listOrders({ userId = null, limit = 20 } = {}) {
  return database.transaction(async (client) => {
    const params = [];
    const conditions = [];

    if (userId) {
      params.push(userId);
      conditions.push(`user_id = $${params.length}`);
    }

    params.push(limit);

    const result = await client.query(
      `SELECT *
       FROM orders
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const itemMap = await loadOrderItems(
      client,
      result.rows.map((row) => row.id),
    );

    return result.rows.map((row) => mapOrder(row, itemMap.get(row.id) ?? []));
  });
}

export async function listLiveOrders() {
  const liveStatuses = new Set(["payment_authorized", "preparing", "out_for_delivery"]);
  const orders = await listOrders({ limit: 200 });
  return orders.filter((order) => liveStatuses.has(order.status));
}

export async function getOrderMetrics() {
  const orders = await listOrders({ limit: 1000 });
  const liveStatuses = new Set(["payment_authorized", "preparing", "out_for_delivery"]);

  return {
    totalOrders: orders.length,
    deliveredOrders: orders.filter((order) => order.status === "delivered").length,
    liveOrders: orders.filter((order) => liveStatuses.has(order.status)).length,
    totalRevenue: orders.filter((order) => order.paymentStatus !== "refunded").reduce((sum, order) => sum + order.total, 0),
  };
}

export async function advanceOrderStatus(orderId) {
  const currentResult = await database.query(
    `SELECT status, payment_status FROM orders WHERE id = $1`,
    [orderId],
  );
  const current = currentResult.rows[0];
  if (!current) return null;

  const status = nextStatus(current.status);
  const paymentStatus =
    status === "delivered"
      ? "captured"
      : status === "pending_payment"
        ? current.payment_status
        : "authorized";

  await database.query(
    `UPDATE orders SET status = $1, payment_status = $2 WHERE id = $3`,
    [status, paymentStatus, orderId],
  );

  return (await listOrders({ limit: 1000 })).find((entry) => entry.id === orderId) ?? null;
}

export async function syncOrderPaymentStatus(orderId, paymentStatus) {
  const result = await database.query(
    `UPDATE orders
     SET payment_status = $1
     WHERE id = $2
     RETURNING *`,
    [paymentStatus, orderId],
  );
  if (!result.rows[0]) return null;

  return (await listOrders({ limit: 1000 })).find((entry) => entry.id === orderId) ?? null;
}

export async function listPromoCodes() {
  return database.transaction(async (client) => {
    const promoResult = await client.query(
      `SELECT id, code, title, discount_percent, enabled
       FROM promo_codes
       ORDER BY code ASC`,
    );
    const cuisineResult = await client.query(
      `SELECT promo_id, cuisine_id FROM promo_code_cuisines ORDER BY cuisine_id ASC`,
    );

    const cuisineMap = new Map();
    for (const row of cuisineResult.rows) {
      const list = cuisineMap.get(row.promo_id) ?? [];
      list.push(row.cuisine_id);
      cuisineMap.set(row.promo_id, list);
    }

    return promoResult.rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      discountPercent: Number(row.discount_percent),
      enabled: row.enabled,
      cuisineIds: cuisineMap.get(row.id) ?? [],
    }));
  });
}

export async function upsertPromoCode(payload) {
  const code = payload?.code?.trim().toUpperCase();
  const title = payload?.title?.trim();
  const discountPercent = Number(payload?.discountPercent ?? 0);
  const cuisineIds = Array.isArray(payload?.cuisineIds) ? payload.cuisineIds.filter(Boolean) : [];
  const enabled = payload?.enabled !== false;
  const id = payload?.id?.trim() || `promo_${crypto.randomUUID().slice(0, 8)}`;

  if (!code || !title || !discountPercent || cuisineIds.length === 0) {
    throw new Error("Promo code, title, discount percent, and cuisines are required.");
  }

  return database.transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO promo_codes (id, code, title, discount_percent, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code,
         title = EXCLUDED.title,
         discount_percent = EXCLUDED.discount_percent,
         enabled = EXCLUDED.enabled
       RETURNING id, code, title, discount_percent, enabled`,
      [id, code, title, discountPercent, enabled],
    );

    await client.query(`DELETE FROM promo_code_cuisines WHERE promo_id = $1`, [id]);
    for (const cuisineId of cuisineIds) {
      await client.query(
        `INSERT INTO promo_code_cuisines (promo_id, cuisine_id) VALUES ($1, $2)`,
        [id, cuisineId],
      );
    }

    return {
      id: result.rows[0].id,
      code: result.rows[0].code,
      title: result.rows[0].title,
      discountPercent: Number(result.rows[0].discount_percent),
      enabled: result.rows[0].enabled,
      cuisineIds,
    };
  });
}

export async function deletePromoCode(id) {
  await database.transaction(async (client) => {
    await client.query(`DELETE FROM promo_code_cuisines WHERE promo_id = $1`, [id]);
    await client.query(`DELETE FROM promo_codes WHERE id = $1`, [id]);
  });
  return true;
}
