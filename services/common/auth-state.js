import crypto from "node:crypto";
import { seededUsers } from "../../server/data.js";
import { createPostgresStore } from "./postgres.js";

const database = createPostgresStore({
  connectionString: process.env.DATABASE_URL ?? "postgresql://bkfast:bkfast@localhost:5432/auth_db",
  schemaStatements: [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
  ],
  seed: async (client) => {
    for (const user of seededUsers) {
      await client.query(
        `INSERT INTO users (id, name, email, role, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (email) DO NOTHING`,
        [user.id, user.name, user.email, user.role, hashPassword(user.password)],
      );
    }
  },
});

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function sanitizeUser(row) {
  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
      }
    : null;
}

function createToken() {
  return `session_${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function createUser(payload) {
  const name = payload?.name?.trim();
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password?.trim();

  if (!name || !email || !password) {
    throw new Error("Name, email, and password are required.");
  }

  return database.transaction(async (client) => {
    const userId = `user_${crypto.randomUUID().slice(0, 8)}`;
    try {
      const userResult = await client.query(
        `INSERT INTO users (id, name, email, role, password_hash, created_at)
         VALUES ($1, $2, $3, 'customer', $4, NOW())
         RETURNING id, name, email, role`,
        [userId, name, email, hashPassword(password)],
      );

      const token = createToken();
      await client.query(
        `INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, NOW())`,
        [token, userId],
      );

      return { token, user: sanitizeUser(userResult.rows[0]) };
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("An account with this email already exists.");
      }
      throw error;
    }
  });
}

export async function loginUser(payload) {
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password?.trim();

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const result = await database.query(
    `SELECT id, name, email, role, password_hash FROM users WHERE email = $1`,
    [email],
  );
  const user = result.rows[0];
  if (!user || user.password_hash !== hashPassword(password)) {
    throw new Error("Invalid credentials.");
  }

  const token = createToken();
  await database.query(`INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, NOW())`, [
    token,
    user.id,
  ]);

  return { token, user: sanitizeUser(user) };
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const result = await database.query(
    `SELECT u.id, u.name, u.email, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`,
    [token],
  );
  return sanitizeUser(result.rows[0]);
}

export async function removeSession(token) {
  if (!token) return true;
  await database.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  return true;
}

export async function listUsers() {
  const result = await database.query(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.role,
       u.created_at,
       COUNT(s.token)::int AS active_sessions
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.id
     GROUP BY u.id
     ORDER BY u.role DESC, u.email ASC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    activeSessions: Number(row.active_sessions),
  }));
}
