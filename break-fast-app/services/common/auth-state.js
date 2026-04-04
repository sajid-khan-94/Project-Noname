import crypto from "node:crypto";
import { seededUsers } from "../../server/data.js";
import { readDomainState, updateDomainState } from "./json-store.js";

const storeName = "auth";

function now() {
  return new Date().toISOString();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function sanitizeUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

function createInitialState() {
  return {
    users: seededUsers.map((user) => ({
      ...user,
      passwordHash: hashPassword(user.password),
      createdAt: now(),
    })),
    sessions: [],
  };
}

function createToken() {
  return `session_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function readAuthState() {
  return readDomainState(storeName, createInitialState);
}

export async function createUser(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const name = payload?.name?.trim();
    const email = payload?.email?.trim().toLowerCase();
    const password = payload?.password?.trim();

    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required.");
    }
    if (state.users.some((user) => user.email === email)) {
      throw new Error("An account with this email already exists.");
    }

    const user = {
      id: `user_${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      role: "customer",
      passwordHash: hashPassword(password),
      createdAt: now(),
    };
    state.users.push(user);

    const token = createToken();
    state.sessions.push({ token, userId: user.id, createdAt: now() });
    return { token, user: sanitizeUser(user) };
  });
}

export async function loginUser(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const email = payload?.email?.trim().toLowerCase();
    const password = payload?.password?.trim();

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const user = state.users.find(
      (entry) => entry.email === email && entry.passwordHash === hashPassword(password),
    );
    if (!user) {
      throw new Error("Invalid credentials.");
    }

    const token = createToken();
    state.sessions.push({ token, userId: user.id, createdAt: now() });
    return { token, user: sanitizeUser(user) };
  });
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const state = await readAuthState();
  const session = state.sessions.find((entry) => entry.token === token);
  const user = state.users.find((entry) => entry.id === session?.userId);
  return sanitizeUser(user);
}

export async function removeSession(token) {
  if (!token) return true;
  return updateDomainState(storeName, createInitialState, async (state) => {
    state.sessions = state.sessions.filter((entry) => entry.token !== token);
    return true;
  });
}

export async function listUsers() {
  const state = await readAuthState();
  return state.users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    activeSessions: state.sessions.filter((entry) => entry.userId === user.id).length,
  }));
}
