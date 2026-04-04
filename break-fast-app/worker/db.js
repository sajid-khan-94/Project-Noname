import {
  buildOrder,
  buildOrderAsync,
  cuisines as seededCuisines,
  findCuisineLabel,
  listMenuItems,
  menuItems as seededMenuItems,
  seededUsers,
} from "../server/data.js";

export const ORDER_STEPS = ["pending_payment", "payment_authorized", "preparing", "out_for_delivery", "delivered"];

const memoryState = {
  cuisines: seededCuisines.map((cuisine) => ({ ...cuisine })),
  menuItems: seededMenuItems.map((item) => ({ ...item })),
  users: seededUsers.map((user) => ({ ...user })),
  sessions: [],
  orders: [],
  promoCodes: [],
  refunds: [],
  paymentGateways: [
    { id: "gateway_stripe", name: "Stripe", provider: "stripe", enabled: true, mode: "live", supportsRefunds: true },
    { id: "gateway_razorpay", name: "Razorpay", provider: "razorpay", enabled: true, mode: "test", supportsRefunds: true },
  ],
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS cuisines (id TEXT PRIMARY KEY, label TEXT NOT NULL, thumbnail_url TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);`,
  `CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY, cuisine_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL, calories INTEGER NOT NULL, prep_time TEXT NOT NULL, spice_level TEXT NOT NULL, color TEXT NOT NULL, popular INTEGER NOT NULL DEFAULT 0);`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, payment_status TEXT NOT NULL, payment_method TEXT NOT NULL, eta_minutes INTEGER NOT NULL, created_at TEXT NOT NULL, subtotal REAL NOT NULL, delivery_fee REAL NOT NULL, platform_fee REAL NOT NULL, total REAL NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, delivery_address TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, item_id INTEGER NOT NULL, name TEXT NOT NULL, cuisine_id TEXT NOT NULL, cuisine_label TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS promo_codes (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, discount_percent REAL NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS promo_code_cuisines (promo_id TEXT NOT NULL, cuisine_id TEXT NOT NULL, PRIMARY KEY (promo_id, cuisine_id));`,
  `CREATE TABLE IF NOT EXISTS refunds (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, amount REAL NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS payment_gateways (id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, mode TEXT NOT NULL, supports_refunds INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);`,
];

const hasDatabase = (env) => Boolean(env?.DB && typeof env.DB.prepare === "function");
const moneyNumber = (value) => Number(value ?? 0);

async function hashPassword(password) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

function normalizeCuisine(row) {
  return { id: row.id, label: row.label, thumbnail: row.thumbnail ?? row.thumbnail_url, enabled: Boolean(row.enabled) };
}

function normalizeMenuItem(row) {
  return {
    id: Number(row.id),
    cuisine: row.cuisine ?? row.cuisine_id,
    name: row.name,
    desc: row.desc ?? row.description,
    price: moneyNumber(row.price),
    cal: Number(row.cal ?? row.calories),
    prepTime: row.prepTime ?? row.prep_time,
    spice: row.spice ?? row.spice_level,
    color: row.color,
    popular: Boolean(row.popular),
  };
}

function normalizePromo(row, cuisineIds = []) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    discountPercent: moneyNumber(row.discountPercent ?? row.discount_percent),
    enabled: Boolean(row.enabled),
    cuisineIds,
  };
}

function normalizeGateway(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    enabled: Boolean(row.enabled),
    mode: row.mode,
    supportsRefunds: Boolean(row.supportsRefunds ?? row.supports_refunds),
  };
}

function normalizeRefund(row) {
  return {
    id: row.id,
    orderId: row.orderId ?? row.order_id,
    amount: moneyNumber(row.amount),
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt ?? row.created_at,
  };
}

function normalizeOrder(order) {
  return {
    ...order,
    userId: order.userId ?? order.user_id,
    paymentStatus: order.paymentStatus ?? order.payment_status,
    paymentMethod: order.paymentMethod ?? order.payment_method,
    etaMinutes: Number(order.etaMinutes ?? order.eta_minutes),
    createdAt: order.createdAt ?? order.created_at,
    subtotal: moneyNumber(order.subtotal),
    deliveryFee: moneyNumber(order.deliveryFee ?? order.delivery_fee),
    platformFee: moneyNumber(order.platformFee ?? order.platform_fee),
    total: moneyNumber(order.total),
    customer: order.customer ?? { name: order.customer_name, phone: order.customer_phone, address: order.delivery_address },
  };
}

function nextStatus(current) {
  const index = ORDER_STEPS.indexOf(current);
  return index === -1 || index === ORDER_STEPS.length - 1 ? current : ORDER_STEPS[index + 1];
}

async function ensureSeedUsers(env) {
  if (!hasDatabase(env)) return;
  for (const user of seededUsers) {
    await env.DB.prepare(`INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(user.id, user.name, user.email, await hashPassword(user.password), user.role, new Date().toISOString())
      .run();
  }
}

export async function initializeDatabase(env) {
  if (!hasDatabase(env)) return false;
  for (const statement of schemaStatements) await env.DB.exec(statement);
  await ensureSeedUsers(env);
  return true;
}

export async function seedDatabase(env) {
  if (!hasDatabase(env)) return { storage: "memory", seeded: false };
  await initializeDatabase(env);
  const writes = [];
  for (const cuisine of seededCuisines) {
    writes.push(env.DB.prepare(`INSERT OR REPLACE INTO cuisines (id, label, thumbnail_url, enabled) VALUES (?1, ?2, ?3, ?4)`).bind(cuisine.id, cuisine.label, cuisine.thumbnail, cuisine.enabled ? 1 : 0));
  }
  for (const item of seededMenuItems) {
    writes.push(env.DB.prepare(`INSERT OR REPLACE INTO menu_items (id, cuisine_id, name, description, price, calories, prep_time, spice_level, color, popular) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
      .bind(item.id, item.cuisine, item.name, item.desc, item.price, item.cal, item.prepTime, item.spice, item.color, item.popular ? 1 : 0));
  }
  for (const gateway of memoryState.paymentGateways) {
    writes.push(env.DB.prepare(`INSERT OR REPLACE INTO payment_gateways (id, name, provider, enabled, mode, supports_refunds, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE((SELECT created_at FROM payment_gateways WHERE id = ?1), ?7))`)
      .bind(gateway.id, gateway.name, gateway.provider, gateway.enabled ? 1 : 0, gateway.mode, gateway.supportsRefunds ? 1 : 0, new Date().toISOString()));
  }
  await env.DB.batch(writes);
  return { storage: "d1", seeded: true, cuisines: seededCuisines.length, menuItems: seededMenuItems.length };
}

export async function getCuisines(env, { includeDisabled = false } = {}) {
  if (!hasDatabase(env)) return memoryState.cuisines.filter((entry) => includeDisabled || entry.enabled);
  await initializeDatabase(env);
  const result = await env.DB.prepare(`SELECT id, label, thumbnail_url, enabled FROM cuisines ORDER BY CASE WHEN id='all' THEN 0 ELSE 1 END, label ASC`).all();
  const list = (result.results.length ? result.results : seededCuisines).map(normalizeCuisine);
  return list.filter((entry) => includeDisabled || entry.enabled);
}

export async function upsertCuisine(env, payload) {
  const id = payload?.id?.trim().toLowerCase();
  const label = payload?.label?.trim();
  const thumbnail = payload?.thumbnail?.trim() || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80";
  const enabled = payload?.enabled !== false;
  if (!id || !label) throw new Error("Cuisine id and label are required.");

  if (!hasDatabase(env)) {
    const existing = memoryState.cuisines.find((entry) => entry.id === id);
    if (existing) Object.assign(existing, { label, thumbnail, enabled });
    else memoryState.cuisines.push({ id, label, thumbnail, enabled });
    return memoryState.cuisines.find((entry) => entry.id === id);
  }
  await initializeDatabase(env);
  await env.DB.prepare(`INSERT OR REPLACE INTO cuisines (id, label, thumbnail_url, enabled) VALUES (?1, ?2, ?3, ?4)`).bind(id, label, thumbnail, enabled ? 1 : 0).run();
  return { id, label, thumbnail, enabled };
}

export async function deleteCuisine(env, id) {
  if (!id || id === "all") throw new Error("This cuisine cannot be removed.");
  if (!hasDatabase(env)) {
    memoryState.cuisines = memoryState.cuisines.filter((entry) => entry.id !== id);
    memoryState.menuItems = memoryState.menuItems.filter((entry) => entry.cuisine !== id);
    memoryState.promoCodes = memoryState.promoCodes.map((promo) => ({ ...promo, cuisineIds: promo.cuisineIds.filter((entry) => entry !== id) }));
    return true;
  }
  await initializeDatabase(env);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM promo_code_cuisines WHERE cuisine_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM menu_items WHERE cuisine_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM cuisines WHERE id = ?1`).bind(id),
  ]);
  return true;
}

export async function getMenuItems(env, { cuisine = "all", search = "" } = {}) {
  const allowed = new Set((await getCuisines(env)).map((entry) => entry.id));
  const term = search.trim().toLowerCase();
  if (!hasDatabase(env)) {
    return memoryState.menuItems.filter((item) => {
      const matchCuisine = cuisine === "all" || !cuisine || item.cuisine === cuisine;
      const matchSearch = !term || item.name.toLowerCase().includes(term) || item.desc.toLowerCase().includes(term) || item.cuisine.toLowerCase().includes(term);
      return allowed.has(item.cuisine) && matchCuisine && matchSearch;
    });
  }
  await initializeDatabase(env);
  let query = `SELECT id, cuisine_id, name, description, price, calories, prep_time, spice_level, color, popular FROM menu_items WHERE 1=1`;
  const bindings = [];
  if (cuisine && cuisine !== "all") {
    query += ` AND cuisine_id = ?`;
    bindings.push(cuisine);
  }
  if (term) {
    query += ` AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(cuisine_id) LIKE ?)`;
    const like = `%${term}%`;
    bindings.push(like, like, like);
  }
  query += ` ORDER BY popular DESC, price ASC`;
  const result = await env.DB.prepare(query).bind(...bindings).all();
  const fallback = listMenuItems({ cuisine, search });
  return (result.results.length ? result.results.map(normalizeMenuItem) : fallback).filter((item) => allowed.has(item.cuisine));
}

export async function getMenuItem(env, id) {
  return (await getMenuItems(env)).find((item) => item.id === Number(id)) ?? null;
}

function createSessionToken() {
  return `session_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function persistSession(env, user) {
  const token = createSessionToken();
  if (!hasDatabase(env)) {
    memoryState.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    return { token, user: sanitizeUser(user) };
  }
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?1, ?2, ?3)`).bind(token, user.id, new Date().toISOString()).run();
  return { token, user: sanitizeUser(user) };
}

export async function registerUser(env, payload) {
  const name = payload?.name?.trim();
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password?.trim();
  if (!name || !email || !password) throw new Error("Name, email, and password are required.");
  if (!hasDatabase(env)) {
    if (memoryState.users.some((entry) => entry.email === email)) throw new Error("An account with this email already exists.");
    const user = { id: `user_${crypto.randomUUID().slice(0, 8)}`, name, email, password, role: "customer", createdAt: new Date().toISOString() };
    memoryState.users.push(user);
    return persistSession(env, user);
  }
  await initializeDatabase(env);
  const exists = await env.DB.prepare(`SELECT id FROM users WHERE email = ?1`).bind(email).first();
  if (exists) throw new Error("An account with this email already exists.");
  const user = { id: `user_${crypto.randomUUID().slice(0, 8)}`, name, email, role: "customer" };
  await env.DB.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`).bind(user.id, user.name, user.email, await hashPassword(password), user.role, new Date().toISOString()).run();
  return persistSession(env, user);
}

export async function loginUser(env, payload) {
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password?.trim();
  if (!email || !password) throw new Error("Email and password are required.");
  if (!hasDatabase(env)) {
    const user = memoryState.users.find((entry) => entry.email === email && entry.password === password);
    if (!user) throw new Error("Invalid credentials.");
    return persistSession(env, user);
  }
  await initializeDatabase(env);
  const user = await env.DB.prepare(`SELECT id, name, email, role, password_hash FROM users WHERE email = ?1`).bind(email).first();
  if (!user || user.password_hash !== await hashPassword(password)) throw new Error("Invalid credentials.");
  return persistSession(env, user);
}

export async function getUserFromToken(env, token) {
  if (!token) return null;
  if (!hasDatabase(env)) {
    const session = memoryState.sessions.find((entry) => entry.token === token);
    return sanitizeUser(memoryState.users.find((entry) => entry.id === session?.userId));
  }
  await initializeDatabase(env);
  const user = await env.DB.prepare(`SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?1`).bind(token).first();
  return sanitizeUser(user);
}

export async function logoutUser(env, token) {
  if (!token) return true;
  if (!hasDatabase(env)) {
    memoryState.sessions = memoryState.sessions.filter((entry) => entry.token !== token);
    return true;
  }
  await initializeDatabase(env);
  await env.DB.prepare(`DELETE FROM sessions WHERE token = ?1`).bind(token).run();
  return true;
}

async function itemLookup(env, itemId) {
  return getMenuItem(env, itemId);
}

export async function createOrderRecord(env, payload, user) {
  if (!user) throw new Error("Please sign in to place an order.");
  const customer = payload?.customer;
  const paymentMethod = payload?.paymentMethod?.trim() || "card";
  if (!customer?.name?.trim() || !customer?.phone?.trim() || !customer?.address?.trim()) throw new Error("Customer name, phone, and delivery address are required.");
  const summary = hasDatabase(env)
    ? await buildOrderAsync(payload?.items ?? [], (itemId) => itemLookup(env, itemId))
    : buildOrder(payload?.items ?? [], (itemId) => memoryState.menuItems.find((entry) => entry.id === Number(itemId)));
  if (!summary.items.length) throw new Error("Order must include at least one valid item.");
  const cuisineLabels = new Map((await getCuisines(env, { includeDisabled: true })).map((entry) => [entry.id, entry.label]));
  const normalizedSummary = { ...summary, items: summary.items.map((item) => ({ ...item, cuisineLabel: cuisineLabels.get(item.cuisine) ?? findCuisineLabel(item.cuisine) })) };
  const order = {
    id: `ord_${crypto.randomUUID().slice(0, 8)}`,
    userId: user.id,
    status: paymentMethod === "cod" ? "pending_payment" : "payment_authorized",
    paymentStatus: paymentMethod === "cod" ? "pending" : "authorized",
    paymentMethod,
    gatewayId: payload?.gatewayId?.trim() || null,
    etaMinutes: 28,
    createdAt: new Date().toISOString(),
    customer: { name: customer.name.trim(), phone: customer.phone.trim(), address: customer.address.trim() },
    ...normalizedSummary,
  };
  if (!hasDatabase(env)) {
    memoryState.orders.unshift(order);
    return order;
  }
  await initializeDatabase(env);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO orders (id, user_id, status, payment_status, payment_method, eta_minutes, created_at, subtotal, delivery_fee, platform_fee, total, customer_name, customer_phone, delivery_address) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`).bind(order.id, order.userId, order.status, order.paymentStatus, order.paymentMethod, order.etaMinutes, order.createdAt, order.subtotal, order.deliveryFee, order.platformFee, order.total, order.customer.name, order.customer.phone, order.customer.address),
    ...order.items.map((item) => env.DB.prepare(`INSERT INTO order_items (order_id, item_id, name, cuisine_id, cuisine_label, quantity, unit_price, line_total) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`).bind(order.id, item.itemId, item.name, item.cuisine, item.cuisineLabel, item.quantity, item.unitPrice, item.lineTotal)),
  ]);
  return order;
}

export async function listOrders(env, { userId = null, limit = 20 } = {}) {
  if (!hasDatabase(env)) return memoryState.orders.filter((entry) => !userId || entry.userId === userId).slice(0, limit);
  await initializeDatabase(env);
  let query = `SELECT id, user_id, status, payment_status, payment_method, eta_minutes, created_at, subtotal, delivery_fee, platform_fee, total, customer_name, customer_phone, delivery_address FROM orders WHERE 1=1`;
  const bindings = [];
  if (userId) {
    query += ` AND user_id = ?`;
    bindings.push(userId);
  }
  query += ` ORDER BY datetime(created_at) DESC LIMIT ?`;
  bindings.push(limit);
  const orders = await env.DB.prepare(query).bind(...bindings).all();
  const items = await env.DB.prepare(`SELECT order_id, item_id, name, cuisine_id, cuisine_label, quantity, unit_price, line_total FROM order_items ORDER BY id ASC`).all();
  return orders.results.map((row) => ({ ...normalizeOrder(row), items: items.results.filter((item) => item.order_id === row.id).map((item) => ({ itemId: Number(item.item_id), name: item.name, cuisine: item.cuisine_id, cuisineLabel: item.cuisine_label, quantity: Number(item.quantity), unitPrice: moneyNumber(item.unit_price), lineTotal: moneyNumber(item.line_total) })) }));
}

export async function advanceOrderStatus(env, orderId) {
  if (!hasDatabase(env)) {
    const order = memoryState.orders.find((entry) => entry.id === orderId);
    if (!order) return null;
    order.status = nextStatus(order.status);
    order.paymentStatus = order.status === "delivered" ? "captured" : order.status === "pending_payment" ? order.paymentStatus : "authorized";
    return order;
  }
  await initializeDatabase(env);
  const current = await env.DB.prepare(`SELECT status, payment_status FROM orders WHERE id = ?1`).bind(orderId).first();
  if (!current) return null;
  const status = nextStatus(current.status);
  const paymentStatus = status === "delivered" ? "captured" : status === "pending_payment" ? current.payment_status : "authorized";
  await env.DB.prepare(`UPDATE orders SET status = ?1, payment_status = ?2 WHERE id = ?3`).bind(status, paymentStatus, orderId).run();
  return (await listOrders(env, { limit: 1000 })).find((entry) => entry.id === orderId) ?? null;
}

export async function listUsers(env) {
  if (!hasDatabase(env)) {
    return memoryState.users.map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, activeSessions: memoryState.sessions.filter((entry) => entry.userId === user.id).length, createdAt: user.createdAt ?? null }));
  }
  await initializeDatabase(env);
  const users = await env.DB.prepare(`SELECT id, name, email, role, created_at FROM users ORDER BY role DESC, email ASC`).all();
  const sessions = await env.DB.prepare(`SELECT user_id, COUNT(*) AS active_sessions FROM sessions GROUP BY user_id`).all();
  return users.results.map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at, activeSessions: Number(sessions.results.find((entry) => entry.user_id === user.id)?.active_sessions ?? 0) }));
}

export async function listPromoCodes(env) {
  if (!hasDatabase(env)) return memoryState.promoCodes;
  await initializeDatabase(env);
  const promos = await env.DB.prepare(`SELECT id, code, title, discount_percent, enabled FROM promo_codes ORDER BY code ASC`).all();
  const promoCuisines = await env.DB.prepare(`SELECT promo_id, cuisine_id FROM promo_code_cuisines ORDER BY cuisine_id ASC`).all();
  return promos.results.map((promo) => normalizePromo(promo, promoCuisines.results.filter((row) => row.promo_id === promo.id).map((row) => row.cuisine_id)));
}

export async function upsertPromoCode(env, payload) {
  const code = payload?.code?.trim().toUpperCase();
  const title = payload?.title?.trim();
  const discountPercent = moneyNumber(payload?.discountPercent);
  const cuisineIds = Array.isArray(payload?.cuisineIds) ? payload.cuisineIds.filter(Boolean) : [];
  const enabled = payload?.enabled !== false;
  const id = payload?.id?.trim() || `promo_${crypto.randomUUID().slice(0, 8)}`;
  if (!code || !title || !discountPercent || cuisineIds.length === 0) throw new Error("Promo code, title, discount percent, and cuisines are required.");
  if (!hasDatabase(env)) {
    const existing = memoryState.promoCodes.find((entry) => entry.id === id || entry.code === code);
    if (existing) Object.assign(existing, { id: existing.id, code, title, discountPercent, cuisineIds, enabled });
    else memoryState.promoCodes.push({ id, code, title, discountPercent, cuisineIds, enabled });
    return memoryState.promoCodes.find((entry) => entry.id === id || entry.code === code);
  }
  await initializeDatabase(env);
  await env.DB.prepare(`INSERT OR REPLACE INTO promo_codes (id, code, title, discount_percent, enabled, created_at) VALUES (?1, ?2, ?3, ?4, ?5, COALESCE((SELECT created_at FROM promo_codes WHERE id = ?1), ?6))`).bind(id, code, title, discountPercent, enabled ? 1 : 0, new Date().toISOString()).run();
  await env.DB.prepare(`DELETE FROM promo_code_cuisines WHERE promo_id = ?1`).bind(id).run();
  if (cuisineIds.length) await env.DB.batch(cuisineIds.map((cuisineId) => env.DB.prepare(`INSERT INTO promo_code_cuisines (promo_id, cuisine_id) VALUES (?1, ?2)`).bind(id, cuisineId)));
  return normalizePromo({ id, code, title, discount_percent: discountPercent, enabled }, cuisineIds);
}

export async function deletePromoCode(env, id) {
  if (!id) throw new Error("Promo code id is required.");
  if (!hasDatabase(env)) {
    memoryState.promoCodes = memoryState.promoCodes.filter((entry) => entry.id !== id);
    return true;
  }
  await initializeDatabase(env);
  await env.DB.batch([env.DB.prepare(`DELETE FROM promo_code_cuisines WHERE promo_id = ?1`).bind(id), env.DB.prepare(`DELETE FROM promo_codes WHERE id = ?1`).bind(id)]);
  return true;
}

export async function listPaymentGateways(env) {
  if (!hasDatabase(env)) return memoryState.paymentGateways;
  await initializeDatabase(env);
  const rows = await env.DB.prepare(`SELECT id, name, provider, enabled, mode, supports_refunds FROM payment_gateways ORDER BY provider ASC, name ASC`).all();
  return rows.results.map(normalizeGateway);
}

export async function upsertPaymentGateway(env, payload) {
  const id = payload?.id?.trim() || `gateway_${crypto.randomUUID().slice(0, 8)}`;
  const name = payload?.name?.trim();
  const provider = payload?.provider?.trim().toLowerCase();
  const mode = payload?.mode?.trim() || "test";
  const enabled = payload?.enabled !== false;
  const supportsRefunds = payload?.supportsRefunds !== false;
  if (!name || !provider) throw new Error("Gateway name and provider are required.");
  if (!hasDatabase(env)) {
    const existing = memoryState.paymentGateways.find((entry) => entry.id === id);
    if (existing) Object.assign(existing, { name, provider, mode, enabled, supportsRefunds });
    else memoryState.paymentGateways.push({ id, name, provider, mode, enabled, supportsRefunds });
    return memoryState.paymentGateways.find((entry) => entry.id === id);
  }
  await initializeDatabase(env);
  await env.DB.prepare(`INSERT OR REPLACE INTO payment_gateways (id, name, provider, enabled, mode, supports_refunds, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE((SELECT created_at FROM payment_gateways WHERE id = ?1), ?7))`).bind(id, name, provider, enabled ? 1 : 0, mode, supportsRefunds ? 1 : 0, new Date().toISOString()).run();
  return { id, name, provider, mode, enabled, supportsRefunds };
}

export async function deletePaymentGateway(env, id) {
  if (!id) throw new Error("Gateway id is required.");
  if (!hasDatabase(env)) {
    memoryState.paymentGateways = memoryState.paymentGateways.filter((entry) => entry.id !== id);
    return true;
  }
  await initializeDatabase(env);
  await env.DB.prepare(`DELETE FROM payment_gateways WHERE id = ?1`).bind(id).run();
  return true;
}

export async function listLiveOrders(env) {
  const liveStatuses = new Set(["payment_authorized", "preparing", "out_for_delivery"]);
  const orders = await listOrders(env, { limit: 200 });
  return orders.filter((order) => liveStatuses.has(order.status));
}

export async function getOrderMetrics(env) {
  const orders = await listOrders(env, { limit: 1000 });
  const liveStatuses = new Set(["payment_authorized", "preparing", "out_for_delivery"]);
  return {
    totalOrders: orders.length,
    deliveredOrders: orders.filter((order) => order.status === "delivered").length,
    liveOrders: orders.filter((order) => liveStatuses.has(order.status)).length,
    totalRevenue: orders.filter((order) => order.paymentStatus !== "refunded").reduce((sum, order) => sum + order.total, 0),
  };
}

export async function listRefunds(env) {
  if (!hasDatabase(env)) return memoryState.refunds;
  await initializeDatabase(env);
  const rows = await env.DB.prepare(`SELECT id, order_id, amount, reason, status, created_at FROM refunds ORDER BY datetime(created_at) DESC`).all();
  return rows.results.map(normalizeRefund);
}

export async function createRefund(env, payload) {
  const orderId = payload?.orderId?.trim();
  const reason = payload?.reason?.trim();
  if (!orderId || !reason) throw new Error("Order id and refund reason are required.");
  const order = (await listOrders(env, { limit: 1000 })).find((entry) => entry.id === orderId);
  if (!order) throw new Error("Order not found.");
  const refund = { id: `refund_${crypto.randomUUID().slice(0, 8)}`, orderId, amount: moneyNumber(payload?.amount ?? order.total), reason, status: "processed", createdAt: new Date().toISOString() };
  if (!hasDatabase(env)) {
    memoryState.refunds.unshift(refund);
    const target = memoryState.orders.find((entry) => entry.id === orderId);
    if (target) target.paymentStatus = "refunded";
    return refund;
  }
  await initializeDatabase(env);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO refunds (id, order_id, amount, reason, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`).bind(refund.id, refund.orderId, refund.amount, refund.reason, refund.status, refund.createdAt),
    env.DB.prepare(`UPDATE orders SET payment_status = 'refunded' WHERE id = ?1`).bind(orderId),
  ]);
  return refund;
}

export async function getBillingSummary(env) {
  const [orders, refunds] = await Promise.all([listOrders(env, { limit: 1000 }), listRefunds(env)]);
  const grossRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const refundedAmount = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return { grossRevenue, refundedAmount, netRevenue: grossRevenue - refundedAmount, refundCount: refunds.length, paidOrders: orders.filter((order) => order.paymentStatus === "authorized" || order.paymentStatus === "captured").length };
}

export async function getStorageInfo(env) {
  if (!hasDatabase(env)) {
    return { mode: "memory", persistent: false, cuisines: memoryState.cuisines.length, menuItems: memoryState.menuItems.length, users: memoryState.users.length, orders: memoryState.orders.length, promoCodes: memoryState.promoCodes.length, refunds: memoryState.refunds.length, paymentGateways: memoryState.paymentGateways.length };
  }
  await initializeDatabase(env);
  const counts = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS count FROM cuisines`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM menu_items`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM users`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM orders`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM promo_codes`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM refunds`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM payment_gateways`).first(),
  ]);
  return {
    mode: "d1",
    persistent: true,
    cuisines: Number(counts[0]?.count ?? 0),
    menuItems: Number(counts[1]?.count ?? 0),
    users: Number(counts[2]?.count ?? 0),
    orders: Number(counts[3]?.count ?? 0),
    promoCodes: Number(counts[4]?.count ?? 0),
    refunds: Number(counts[5]?.count ?? 0),
    paymentGateways: Number(counts[6]?.count ?? 0),
  };
}

export { findCuisineLabel };
