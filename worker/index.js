import {
  advanceOrderStatus,
  createOrderRecord,
  createRefund,
  deletePaymentGateway,
  deleteCuisine,
  deletePromoCode,
  getBillingSummary,
  getCuisines,
  getMenuItem,
  getMenuItems,
  getOrderMetrics,
  getStorageInfo,
  getUserFromToken,
  initializeDatabase,
  listLiveOrders,
  listOrders,
  listPaymentGateways,
  listPromoCodes,
  listRefunds,
  listUsers,
  loginUser,
  logoutUser,
  registerUser,
  seedDatabase,
  upsertCuisine,
  upsertPaymentGateway,
  upsertPromoCode,
} from "./db.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

const rolePermissions = {
  admin: new Set(["orders", "catalog", "users", "promos", "billing", "gateways"]),
  manager: new Set(["orders", "catalog", "users", "promos"]),
  finance: new Set(["billing", "gateways"]),
  operations: new Set(["orders"]),
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

function hasPermission(user, permission) {
  if (!user) return false;
  return rolePermissions[user.role]?.has(permission) ?? false;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const auth = await getAuth(request, env);
    const canOrders = hasPermission(auth.user, "orders");
    const canCatalog = hasPermission(auth.user, "catalog");
    const canUsers = hasPermission(auth.user, "users");
    const canPromos = hasPermission(auth.user, "promos");
    const canBilling = hasPermission(auth.user, "billing");
    const canGateways = hasPermission(auth.user, "gateways");

    if (pathname === "/api/health") {
      return json({
        ok: true,
        service: "bkfast-direct-order-api",
        timestamp: new Date().toISOString(),
        storage: await getStorageInfo(env),
      });
    }

    if (pathname === "/api/cuisines") {
      return json({ data: await getCuisines(env, { includeDisabled: Boolean(searchParams.get("includeDisabled")) && auth.user?.role !== "customer" }) });
    }

    if (pathname === "/api/menu-items") {
      return json({
        data: await getMenuItems(env, {
          cuisine: searchParams.get("cuisine") ?? "all",
          search: searchParams.get("search") ?? "",
        }),
      });
    }

    if (pathname === "/api/payment-gateways") {
      const gateways = await listPaymentGateways(env);
      return json({
        data: gateways.filter((gateway) => gateway.enabled),
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
      return auth.user
        ? json({
            data: {
              ...auth.user,
              permissions: Array.from(rolePermissions[auth.user.role] ?? []),
            },
          })
        : unauthorized();
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
      if (!canOrders) return unauthorized();
      return json({ data: await listOrders(env, { limit: Number(searchParams.get("limit") ?? 50) }) });
    }

    if (pathname === "/api/admin/orders/live") {
      if (!canOrders) return unauthorized();
      return json({ data: await listLiveOrders(env) });
    }

    if (pathname === "/api/admin/orders/metrics") {
      if (!canOrders && !canBilling) return unauthorized();
      return json({ data: await getOrderMetrics(env) });
    }

    if (pathname === "/api/admin/cuisines" && request.method === "GET") {
      if (!canCatalog) return unauthorized();
      return json({ data: await getCuisines(env, { includeDisabled: true }) });
    }

    if (pathname === "/api/admin/cuisines" && request.method === "POST") {
      if (!canCatalog) return unauthorized();
      try {
        return json({ data: await upsertCuisine(env, await request.json()) }, { status: 201 });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname.startsWith("/api/admin/cuisines/") && request.method === "DELETE") {
      if (!canCatalog) return unauthorized();
      try {
        await deleteCuisine(env, pathname.split("/")[4]);
        return json({ data: { ok: true } });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname === "/api/admin/users") {
      if (!canUsers) return unauthorized();
      return json({ data: await listUsers(env) });
    }

    if (pathname === "/api/admin/promos" && request.method === "GET") {
      if (!canPromos) return unauthorized();
      return json({ data: await listPromoCodes(env) });
    }

    if (pathname === "/api/admin/promos" && request.method === "POST") {
      if (!canPromos) return unauthorized();
      try {
        return json({ data: await upsertPromoCode(env, await request.json()) }, { status: 201 });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname.startsWith("/api/admin/promos/") && request.method === "DELETE") {
      if (!canPromos) return unauthorized();
      try {
        await deletePromoCode(env, pathname.split("/")[4]);
        return json({ data: { ok: true } });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname === "/api/admin/billing") {
      if (!canBilling) return unauthorized();
      return json({ data: await getBillingSummary(env) });
    }

    if (pathname === "/api/admin/refunds" && request.method === "GET") {
      if (!canBilling) return unauthorized();
      return json({ data: await listRefunds(env) });
    }

    if (pathname === "/api/admin/refunds" && request.method === "POST") {
      if (!canBilling) return unauthorized();
      try {
        return json({ data: await createRefund(env, await request.json()) }, { status: 201 });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname === "/api/admin/payment-gateways" && request.method === "GET") {
      if (!canGateways) return unauthorized();
      return json({ data: await listPaymentGateways(env) });
    }

    if (pathname === "/api/admin/payment-gateways" && request.method === "POST") {
      if (!canGateways) return unauthorized();
      try {
        return json({ data: await upsertPaymentGateway(env, await request.json()) }, { status: 201 });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname.startsWith("/api/admin/payment-gateways/") && request.method === "DELETE") {
      if (!canGateways) return unauthorized();
      try {
        await deletePaymentGateway(env, pathname.split("/")[4]);
        return json({ data: { ok: true } });
      } catch (error) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    if (pathname.startsWith("/api/admin/orders/") && pathname.endsWith("/advance") && request.method === "POST") {
      if (!canOrders) return unauthorized();
      const order = await advanceOrderStatus(env, pathname.split("/")[4]);
      return order ? json({ data: order }) : notFound();
    }

    if (pathname === "/api/admin/init" && request.method === "POST") {
      if (!canCatalog && !canGateways) return unauthorized();
      await initializeDatabase(env);
      return json({ data: { initialized: true } }, { status: 201 });
    }

    if (pathname === "/api/admin/seed" && request.method === "POST") {
      if (!canCatalog) return unauthorized();
      return json({ data: await seedDatabase(env) }, { status: 201 });
    }

    return notFound();
  },
};
