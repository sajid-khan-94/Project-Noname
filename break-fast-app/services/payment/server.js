import http from "node:http";
import {
  createRefund,
  deletePaymentGateway,
  getBillingSummary,
  initializePayment,
  listPaymentGateways,
  listPayments,
  listRefunds,
  upsertPaymentGateway,
} from "../common/payment-state.js";
import {
  badRequest,
  getUrl,
  handleRequest,
  notFound,
  readJsonBody,
  sendEmpty,
  sendJson,
} from "../common/http.js";

const port = Number(process.env.PORT ?? 8082);

const server = http.createServer((request, response) =>
  handleRequest(response, async () => {
    if (request.method === "OPTIONS") {
      return sendEmpty(response);
    }

    const url = getUrl(request);

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "payment-service",
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === "GET" && url.pathname === "/gateways/public") {
      return sendJson(response, 200, { data: await listPaymentGateways({ onlyEnabled: true }) });
    }

    if (request.method === "GET" && url.pathname === "/gateways") {
      return sendJson(response, 200, { data: await listPaymentGateways() });
    }

    if (request.method === "POST" && url.pathname === "/gateways") {
      try {
        return sendJson(response, 201, {
          data: await upsertPaymentGateway(await readJsonBody(request)),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/gateways/")) {
      await deletePaymentGateway(url.pathname.split("/")[2]);
      return sendJson(response, 200, { data: { ok: true } });
    }

    if (request.method === "POST" && url.pathname === "/payments/initialize") {
      try {
        return sendJson(response, 201, {
          data: await initializePayment(await readJsonBody(request)),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "GET" && url.pathname === "/payments/history") {
      return sendJson(response, 200, { data: await listPayments() });
    }

    if (request.method === "GET" && url.pathname === "/billing") {
      return sendJson(response, 200, { data: await getBillingSummary() });
    }

    if (request.method === "GET" && url.pathname === "/refunds") {
      return sendJson(response, 200, { data: await listRefunds() });
    }

    if (request.method === "POST" && url.pathname === "/refunds") {
      try {
        return sendJson(response, 201, {
          data: await createRefund(await readJsonBody(request)),
        });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    return notFound(response);
  }),
);

server.listen(port, () => {
  console.log(`payment-service listening on ${port}`);
});
