CREATE TABLE IF NOT EXISTS cuisines (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  cuisine_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  calories INTEGER NOT NULL,
  prep_time TEXT NOT NULL,
  spice_level TEXT NOT NULL,
  color TEXT NOT NULL,
  popular INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  eta_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL,
  platform_fee REAL NOT NULL,
  total REAL NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  cuisine_id TEXT NOT NULL,
  cuisine_label TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  discount_percent REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_code_cuisines (
  promo_id TEXT NOT NULL,
  cuisine_id TEXT NOT NULL,
  PRIMARY KEY (promo_id, cuisine_id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_gateways (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  mode TEXT NOT NULL,
  supports_refunds INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
