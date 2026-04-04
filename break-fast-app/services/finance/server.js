import http from "node:http";
import {
  advanceOrderStatus,
  createOrder,
  deleteCuisine,
  deletePromoCode,
  getOrderMetrics,
  listCuisines,
  listLiveOrders,
  listMenuItems,
  listOrders,
  listPromoCodes,
  syncOrderPaymentStatus,
  upsertCuisine,
  upsertPromoCode,
} from "../common/finance-state.js";
import {
  badRequest,
  getUrl,
  handleRequest,
  notFound,
  readJsonBody,
  sendEmpty,
  sendJson,
} from "../common/http.js";

const port = Number(process.env.PORT ?? 8083);

const server = http.createServer((request, response) =>
  handleRequest(response, async () => {
    if (request.method === "OPTIONS") {
      return sendEmpty(response);
    }

    const url = getUrl(request);

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "finance-service",
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === "GET" && url.pathname === "/cuisines") {
      return sendJson(response, 200, {
        data: await listCuisines({ includeDisabled: url.searchParams.get("includeDisabled") === "true" }),
      });
    }

    if (request.method === "POST" && url.pathname === "/cuisines") {
      try {
        return sendJson(response, 201, { data: await upsertCuisine(await readJsonBody(request)) });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/cuisines/")) {
      try {
        await deleteCuisine(url.pathname.split("/")[2]);
        return sendJson(response, 200, { data: { ok: true } });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "GET" && url.pathname === "/menu-items") {
      return sendJson(response, 200, {
        data: await listMenuItems({
          cuisine: url.searchParams.get("cuisine") ?? "all",
          search: url.searchParams.get("search") ?? "",
        }),
      });
    }

    if (request.method === "POST" && url.pathname === "/orders") {
      try {
        return sendJson(response, 201, { data: await createOrder(await readJsonBody(request)) });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "GET" && url.pathname === "/orders") {
      return sendJson(response, 200, {
        data: await listOrders({
          userId: url.searchParams.get("userId") || null,
          limit: Number(url.searchParams.get("limit") ?? 50),
        }),
      });
    }

    if (request.method === "GET" && url.pathname === "/orders/live") {
      return sendJson(response, 200, { data: await listLiveOrders() });
    }

    if (request.method === "GET" && url.pathname === "/orders/metrics") {
      return sendJson(response, 200, { data: await getOrderMetrics() });
    }

    if (request.method === "POST" && url.pathname.startsWith("/orders/") && url.pathname.endsWith("/advance")) {
      const orderId = url.pathname.split("/")[2];
      const order = await advanceOrderStatus(orderId);
      return order ? sendJson(response, 200, { data: order }) : notFound(response);
    }

    if (request.method === "POST" && url.pathname.startsWith("/orders/") && url.pathname.endsWith("/payment-status")) {
      const orderId = url.pathname.split("/")[2];
      const payload = await readJsonBody(request);
      const order = await syncOrderPaymentStatus(orderId, payload?.paymentStatus);
      return order ? sendJson(response, 200, { data: order }) : notFound(response);
    }

    if (request.method === "GET" && url.pathname === "/promos") {
      return sendJson(response, 200, { data: await listPromoCodes() });
    }

    if (request.method === "POST" && url.pathname === "/promos") {
      try {
        return sendJson(response, 201, { data: await upsertPromoCode(await readJsonBody(request)) });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/promos/")) {
      await deletePromoCode(url.pathname.split("/")[2]);
      return sendJson(response, 200, { data: { ok: true } });
    }

    return notFound(response);
  }),
);

server.listen(port, () => {
  console.log(`finance-service listening on ${port}`);
});
