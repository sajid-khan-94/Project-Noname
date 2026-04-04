import http from "node:http";
import {
  badRequest,
  getBearerToken,
  getUrl,
  handleRequest,
  notFound,
  readJsonBody,
  sendEmpty,
  sendJson,
  unauthorized,
} from "../common/http.js";

const port = Number(process.env.PORT ?? 8080);
const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://auth-service:8081";
const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL ?? "http://payment-service:8082";
const financeServiceUrl = process.env.FINANCE_SERVICE_URL ?? "http://finance-service:8083";

const rolePermissions = {
  admin: new Set(["orders", "catalog", "users", "promos", "billing", "gateways"]),
  manager: new Set(["orders", "catalog", "users", "promos"]),
  finance: new Set(["billing", "gateways"]),
  operations: new Set(["orders"]),
};

async function callService(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Upstream request failed: ${path}`);
  }

  return payload.data;
}

async function getSessionUser(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return await callService(authServiceUrl, "/session", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return null;
  }
}

function can(user, permission) {
  return rolePermissions[user?.role]?.has(permission) ?? false;
}

const server = http.createServer((request, response) =>
  handleRequest(response, async () => {
    if (request.method === "OPTIONS") {
      return sendEmpty(response);
    }

    const url = getUrl(request);
    const user = await getSessionUser(request);

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      const [auth, payment, finance] = await Promise.all([
        callService(authServiceUrl, "/health").catch((error) => ({ ok: false, error: error.message })),
        callService(paymentServiceUrl, "/health").catch((error) => ({ ok: false, error: error.message })),
        callService(financeServiceUrl, "/health").catch((error) => ({ ok: false, error: error.message })),
      ]);

      return sendJson(response, 200, {
        ok: true,
        service: "gateway-service",
        timestamp: new Date().toISOString(),
        downstream: { auth, payment, finance },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      try {
        return sendJson(response, 201, {
          data: await callService(authServiceUrl, "/register", {
            method: "POST",
            body: JSON.stringify(await readJsonBody(request)),
          }),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      try {
        return sendJson(response, 200, {
          data: await callService(authServiceUrl, "/login", {
            method: "POST",
            body: JSON.stringify(await readJsonBody(request)),
          }),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      if (!user) return unauthorized(response);
      return sendJson(response, 200, {
        data: { ...user, permissions: Array.from(rolePermissions[user.role] ?? []) },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      await callService(authServiceUrl, "/logout", {
        method: "POST",
        headers: request.headers.authorization ? { Authorization: request.headers.authorization } : {},
      });
      return sendJson(response, 200, { data: { ok: true } });
    }

    if (request.method === "GET" && url.pathname === "/api/cuisines") {
      const includeDisabled = url.searchParams.get("includeDisabled") === "true" && user?.role !== "customer";
      return sendJson(response, 200, {
        data: await callService(financeServiceUrl, `/cuisines?includeDisabled=${includeDisabled}`),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/menu-items") {
      const params = new URLSearchParams();
      if (url.searchParams.get("cuisine")) params.set("cuisine", url.searchParams.get("cuisine"));
      if (url.searchParams.get("search")) params.set("search", url.searchParams.get("search"));
      return sendJson(response, 200, {
        data: await callService(financeServiceUrl, `/menu-items${params.toString() ? `?${params.toString()}` : ""}`),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/payment-gateways") {
      return sendJson(response, 200, {
        data: await callService(paymentServiceUrl, "/gateways/public"),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/orders") {
      if (!user) return unauthorized(response);
      try {
        const payload = await readJsonBody(request);
        const order = await callService(financeServiceUrl, "/orders", {
          method: "POST",
          body: JSON.stringify({ ...payload, user }),
        });

        const payment = await callService(paymentServiceUrl, "/payments/initialize", {
          method: "POST",
          body: JSON.stringify({
            orderId: order.id,
            userId: user.id,
            amount: order.total,
            paymentMethod: order.paymentMethod,
            gatewayId: order.gatewayId,
          }),
        });

        return sendJson(response, 201, {
          data: {
            ...order,
            paymentStatus: payment.paymentStatus,
            paymentHistory: payment.history,
          },
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orders/my") {
      if (!user) return unauthorized(response);
      return sendJson(response, 200, {
        data: await callService(financeServiceUrl, `/orders?userId=${user.id}&limit=25`),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/orders") {
      if (!can(user, "orders")) return unauthorized(response);
      return sendJson(response, 200, {
        data: await callService(financeServiceUrl, `/orders?limit=${Number(url.searchParams.get("limit") ?? 50)}`),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/orders/live") {
      if (!can(user, "orders")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(financeServiceUrl, "/orders/live") });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/orders/metrics") {
      if (!can(user, "orders") && !can(user, "billing")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(financeServiceUrl, "/orders/metrics") });
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/admin/orders/") && url.pathname.endsWith("/advance")) {
      if (!can(user, "orders")) return unauthorized(response);
      const orderId = url.pathname.split("/")[4];
      return sendJson(response, 200, {
        data: await callService(financeServiceUrl, `/orders/${orderId}/advance`, { method: "POST" }),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/cuisines") {
      if (!can(user, "catalog")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(financeServiceUrl, "/cuisines?includeDisabled=true") });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/cuisines") {
      if (!can(user, "catalog")) return unauthorized(response);
      try {
        return sendJson(response, 201, {
          data: await callService(financeServiceUrl, "/cuisines", {
            method: "POST",
            body: JSON.stringify(await readJsonBody(request)),
          }),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/cuisines/")) {
      if (!can(user, "catalog")) return unauthorized(response);
      const cuisineId = url.pathname.split("/")[4];
      await callService(financeServiceUrl, `/cuisines/${cuisineId}`, { method: "DELETE" });
      return sendJson(response, 200, { data: { ok: true } });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      if (!can(user, "users")) return unauthorized(response);
      return sendJson(response, 200, {
        data: await callService(authServiceUrl, "/internal/users"),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/promos") {
      if (!can(user, "promos")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(financeServiceUrl, "/promos") });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/promos") {
      if (!can(user, "promos")) return unauthorized(response);
      try {
        return sendJson(response, 201, {
          data: await callService(financeServiceUrl, "/promos", {
            method: "POST",
            body: JSON.stringify(await readJsonBody(request)),
          }),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/promos/")) {
      if (!can(user, "promos")) return unauthorized(response);
      const promoId = url.pathname.split("/")[4];
      await callService(financeServiceUrl, `/promos/${promoId}`, { method: "DELETE" });
      return sendJson(response, 200, { data: { ok: true } });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/billing") {
      if (!can(user, "billing")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(paymentServiceUrl, "/billing") });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/refunds") {
      if (!can(user, "billing")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(paymentServiceUrl, "/refunds") });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/refunds") {
      if (!can(user, "billing")) return unauthorized(response);
      try {
        const refundPayload = await readJsonBody(request);
        const refund = await callService(paymentServiceUrl, "/refunds", {
          method: "POST",
          body: JSON.stringify(refundPayload),
        });
        await callService(financeServiceUrl, `/orders/${refund.orderId}/payment-status`, {
          method: "POST",
          body: JSON.stringify({ paymentStatus: "refunded" }),
        });
        return sendJson(response, 201, { data: refund });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/payment-gateways") {
      if (!can(user, "gateways")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(paymentServiceUrl, "/gateways") });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/payment-gateways") {
      if (!can(user, "gateways")) return unauthorized(response);
      try {
        return sendJson(response, 201, {
          data: await callService(paymentServiceUrl, "/gateways", {
            method: "POST",
            body: JSON.stringify(await readJsonBody(request)),
          }),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/payment-gateways/")) {
      if (!can(user, "gateways")) return unauthorized(response);
      const gatewayId = url.pathname.split("/")[4];
      await callService(paymentServiceUrl, `/gateways/${gatewayId}`, { method: "DELETE" });
      return sendJson(response, 200, { data: { ok: true } });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/payments/history") {
      if (!can(user, "billing")) return unauthorized(response);
      return sendJson(response, 200, { data: await callService(paymentServiceUrl, "/payments/history") });
    }

    return notFound(response);
  }),
);

server.listen(port, () => {
  console.log(`gateway-service listening on ${port}`);
});
