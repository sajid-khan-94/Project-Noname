import {
  advanceOrderStatus,
  createOrderRecord,
  getCuisines,
  getMenuItem,
  getMenuItems,
  getStorageInfo,
  getUserFromToken,
  initializeDatabase,
  listOrders,
  loginUser,
  logoutUser,
  registerUser,
  seedDatabase,
} from "./db.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers ?? {}) },
  });
}

function notFound() {
  return json({ error: "Not found" }, { status: 404 });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

async function getAuth(request, env) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return { token, user: await getUserFromToken(env, token) };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const auth = await getAuth(request, env);
    const isAdmin = auth.user?.role === "admin";

    if (pathname === "/api/health") {
      return json({
        ok: true,
        service: "bkfast-direct-order-api",
        timestamp: new Date().toISOString(),
        storage: await getStorageInfo(env),
      });
    }

    if (pathname === "/api/cuisines") {
      return json({ data: await getCuisines(env) });
    }

    if (pathname === "/api/menu-items") {
      return json({
        data: await getMenuItems(env, {
          cuisine: searchParams.get("cuisine") ?? "all",
          search: searchParams.get("search") ?? "",
        }),
      });
    }

    if (pathname.startsWith("/api/menu-items/")) {
      const item = await getMenuItem(env, pathname.split("/").pop());
      return item ? json({ data: item }) : notFound();
    }

    if (pathname === "/api/auth/register" && request.method === "POST") {
      try {
        return json({ data: await registerUser(env, await request.json()) }, { status: 201 });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      try {
        return json({ data: await loginUser(env, await request.json()) });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname === "/api/auth/session") {
      return auth.user ? json({ data: auth.user }) : unauthorized();
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      await logoutUser(env, auth.token);
      return json({ data: { ok: true } });
    }

    if (pathname === "/api/orders" && request.method === "POST") {
      try {
        return json({ data: await createOrderRecord(env, await request.json(), auth.user) }, { status: 201 });
      } catch (error) {
        return json({ error: error.message }, { status: error.message.includes("sign in") ? 401 : 400 });
      }
    }

    if (pathname === "/api/orders/my") {
      if (!auth.user) return unauthorized();
      return json({ data: await listOrders(env, { userId: auth.user.id, limit: 25 }) });
    }

    if (pathname === "/api/admin/orders") {
      if (!isAdmin) return unauthorized();
      return json({ data: await listOrders(env, { limit: Number(searchParams.get("limit") ?? 50) }) });
    }

    if (pathname.startsWith("/api/admin/orders/") && pathname.endsWith("/advance") && request.method === "POST") {
      if (!isAdmin) return unauthorized();
      const order = await advanceOrderStatus(env, pathname.split("/")[4]);
      return order ? json({ data: order }) : notFound();
    }

    if (pathname === "/api/admin/init" && request.method === "POST") {
      if (!isAdmin) return unauthorized();
      await initializeDatabase(env);
      return json({ data: { initialized: true } }, { status: 201 });
    }

    if (pathname === "/api/admin/seed" && request.method === "POST") {
      if (!isAdmin) return unauthorized();
      return json({ data: await seedDatabase(env) }, { status: 201 });
    }

    return notFound();
  },
};
