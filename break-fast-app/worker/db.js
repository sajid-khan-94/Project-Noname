import {
  buildOrder,
  buildOrderAsync,
  cuisines,
  findCuisineLabel,
  getMenuItemById,
  listMenuItems,
  menuItems,
  seededUsers,
} from "../server/data.js";

export const ORDER_STEPS = ["pending_payment", "payment_authorized", "preparing", "out_for_delivery", "delivered"];

const memoryState = {
  users: seededUsers.map((user) => ({ ...user })),
  sessions: [],
  orders: [],
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS cuisines (id TEXT PRIMARY KEY, label TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY, cuisine_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL, calories INTEGER NOT NULL, prep_time TEXT NOT NULL, spice_level TEXT NOT NULL, color TEXT NOT NULL, popular INTEGER NOT NULL DEFAULT 0);`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, payment_status TEXT NOT NULL, payment_method TEXT NOT NULL, eta_minutes INTEGER NOT NULL, created_at TEXT NOT NULL, subtotal REAL NOT NULL, delivery_fee REAL NOT NULL, platform_fee REAL NOT NULL, total REAL NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, delivery_address TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, item_id INTEGER NOT NULL, name TEXT NOT NULL, cuisine_id TEXT NOT NULL, cuisine_label TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL);`,
];

function hasDatabase(env) {
  return Boolean(env?.DB && typeof env.DB.prepare === "function");
}

async function hashPassword(password) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

function normalizeMenuItem(row) {
  return {
    id: Number(row.id),
    cuisine: row.cuisine ?? row.cuisine_id,
    name: row.name,
    desc: row.desc ?? row.description,
    price: Number(row.price),
    cal: Number(row.cal ?? row.calories),
    prepTime: row.prepTime ?? row.prep_time,
    spice: row.spice ?? row.spice_level,
    color: row.color,
    popular: Boolean(row.popular),
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
  for (const cuisine of cuisines) {
    writes.push(env.DB.prepare(`INSERT OR REPLACE INTO cuisines (id, label) VALUES (?1, ?2)`).bind(cuisine.id, cuisine.label));
  }
  for (const item of menuItems) {
    writes.push(env.DB.prepare(`INSERT OR REPLACE INTO menu_items (id, cuisine_id, name, description, price, calories, prep_time, spice_level, color, popular) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
      .bind(item.id, item.cuisine, item.name, item.desc, item.price, item.cal, item.prepTime, item.spice, item.color, item.popular ? 1 : 0));
  }
  await env.DB.batch(writes);
  return { storage: "d1", seeded: true, cuisines: cuisines.length, menuItems: menuItems.length };
}

export async function getCuisines(env) {
  if (!hasDatabase(env)) return cuisines;
  await initializeDatabase(env);
  const result = await env.DB.prepare(`SELECT id, label FROM cuisines ORDER BY CASE WHEN id='all' THEN 0 ELSE 1 END, label ASC`).all();
  return result.results.length ? result.results : cuisines;
}

export async function getMenuItems(env, { cuisine = "all", search = "" } = {}) {
  if (!hasDatabase(env)) return listMenuItems({ cuisine, search });
  await initializeDatabase(env);
  let query = `SELECT id, cuisine_id, name, description, price, calories, prep_time, spice_level, color, popular FROM menu_items WHERE 1=1`;
  const bindings = [];
  const term = search.trim().toLowerCase();
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
  return result.results.length ? result.results.map(normalizeMenuItem) : listMenuItems({ cuisine, search });
}

export async function getMenuItem(env, id) {
  if (!hasDatabase(env)) return getMenuItemById(id);
  await initializeDatabase(env);
  const row = await env.DB.prepare(`SELECT id, cuisine_id, name, description, price, calories, prep_time, spice_level, color, popular FROM menu_items WHERE id=?1`).bind(Number(id)).first();
  return row ? normalizeMenuItem(row) : getMenuItemById(id);
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
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?1, ?2, ?3)`)
    .bind(token, user.id, new Date().toISOString())
    .run();
  return { token, user: sanitizeUser(user) };
}

export async function registerUser(env, payload) {
  const name = payload?.name?.trim();
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password?.trim();
  if (!name || !email || !password) throw new Error("Name, email, and password are required.");

  if (!hasDatabase(env)) {
    if (memoryState.users.some((user) => user.email === email)) throw new Error("An account with this email already exists.");
    const user = { id: `user_${crypto.randomUUID().slice(0, 8)}`, name, email, password, role: "customer" };
    memoryState.users.push(user);
    return persistSession(env, user);
  }

  await initializeDatabase(env);
  const exists = await env.DB.prepare(`SELECT id FROM users WHERE email = ?1`).bind(email).first();
  if (exists) throw new Error("An account with this email already exists.");
  const user = { id: `user_${crypto.randomUUID().slice(0, 8)}`, name, email, role: "customer" };
  await env.DB.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
    .bind(user.id, user.name, user.email, await hashPassword(password), user.role, new Date().toISOString())
    .run();
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

function normalizeOrder(order) {
  return {
    ...order,
    userId: order.userId ?? order.user_id,
    status: order.status,
    paymentStatus: order.paymentStatus ?? order.payment_status,
    paymentMethod: order.paymentMethod ?? order.payment_method,
    etaMinutes: Number(order.etaMinutes ?? order.eta_minutes),
    createdAt: order.createdAt ?? order.created_at,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee ?? order.delivery_fee),
    platformFee: Number(order.platformFee ?? order.platform_fee),
    total: Number(order.total),
    customer: order.customer ?? { name: order.customer_name, phone: order.customer_phone, address: order.delivery_address },
  };
}

export async function createOrderRecord(env, payload, user) {
  if (!user) throw new Error("Please sign in to place an order.");
  const customer = payload?.customer;
  const paymentMethod = payload?.paymentMethod?.trim() || "card";
  if (!customer?.name?.trim() || !customer?.phone?.trim() || !customer?.address?.trim()) throw new Error("Customer name, phone, and delivery address are required.");
  const summary = hasDatabase(env) ? await buildOrderAsync(payload?.items ?? [], (itemId) => itemLookup(env, itemId)) : buildOrder(payload?.items ?? []);
  if (!summary.items.length) throw new Error("Order must include at least one valid item.");

  const order = {
    id: `ord_${crypto.randomUUID().slice(0, 8)}`,
    userId: user.id,
    status: paymentMethod === "cod" ? "pending_payment" : "payment_authorized",
    paymentStatus: paymentMethod === "cod" ? "pending" : "authorized",
    paymentMethod,
    etaMinutes: 28,
    createdAt: new Date().toISOString(),
    customer: { name: customer.name.trim(), phone: customer.phone.trim(), address: customer.address.trim() },
    ...summary,
  };

  if (!hasDatabase(env)) {
    memoryState.orders.unshift(order);
    return order;
  }

  await initializeDatabase(env);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO orders (id, user_id, status, payment_status, payment_method, eta_minutes, created_at, subtotal, delivery_fee, platform_fee, total, customer_name, customer_phone, delivery_address) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`)
      .bind(order.id, order.userId, order.status, order.paymentStatus, order.paymentMethod, order.etaMinutes, order.createdAt, order.subtotal, order.deliveryFee, order.platformFee, order.total, order.customer.name, order.customer.phone, order.customer.address),
    ...order.items.map((item) => env.DB.prepare(`INSERT INTO order_items (order_id, item_id, name, cuisine_id, cuisine_label, quantity, unit_price, line_total) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
      .bind(order.id, item.itemId, item.name, item.cuisine, item.cuisineLabel, item.quantity, item.unitPrice, item.lineTotal)),
  ]);
  return order;
}

export async function listOrders(env, { userId = null, limit = 20 } = {}) {
  if (!hasDatabase(env)) {
    return memoryState.orders.filter((order) => !userId || order.userId === userId).slice(0, limit);
  }

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
  const orderItems = await env.DB.prepare(`SELECT order_id, item_id, name, cuisine_id, cuisine_label, quantity, unit_price, line_total FROM order_items ORDER BY id ASC`).all();
  return orders.results.map((row) => ({
    ...normalizeOrder(row),
    items: orderItems.results.filter((item) => item.order_id === row.id).map((item) => ({
      itemId: Number(item.item_id),
      name: item.name,
      cuisine: item.cuisine_id,
      cuisineLabel: item.cuisine_label,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
  }));
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

export async function getStorageInfo(env) {
  if (!hasDatabase(env)) {
    return { mode: "memory", persistent: false, cuisines: cuisines.length, menuItems: menuItems.length, users: memoryState.users.length, orders: memoryState.orders.length };
  }
  await initializeDatabase(env);
  const [cuisineCount, itemCount, userCount, orderCount] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS count FROM cuisines`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM menu_items`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM users`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM orders`).first(),
  ]);
  return { mode: "d1", persistent: true, cuisines: Number(cuisineCount?.count ?? 0), menuItems: Number(itemCount?.count ?? 0), users: Number(userCount?.count ?? 0), orders: Number(orderCount?.count ?? 0) };
}

export { findCuisineLabel };
