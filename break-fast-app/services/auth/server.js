import http from "node:http";
import {
  createUser,
  getUserFromToken,
  listUsers,
  loginUser,
  removeSession,
} from "../common/auth-state.js";
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

const port = Number(process.env.PORT ?? 8081);

const server = http.createServer((request, response) =>
  handleRequest(response, async () => {
    if (request.method === "OPTIONS") {
      return sendEmpty(response);
    }

    const url = getUrl(request);

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "auth-service",
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === "POST" && url.pathname === "/register") {
      try {
        const data = await createUser(await readJsonBody(request));
        return sendJson(response, 201, { data });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "POST" && url.pathname === "/login") {
      try {
        const data = await loginUser(await readJsonBody(request));
        return sendJson(response, 200, { data });
      } catch (error) {
        return badRequest(response, error.message);
      }
    }

    if (request.method === "GET" && url.pathname === "/session") {
      const user = await getUserFromToken(getBearerToken(request));
      return user ? sendJson(response, 200, { data: user }) : unauthorized(response);
    }

    if (request.method === "POST" && url.pathname === "/logout") {
      await removeSession(getBearerToken(request));
      return sendJson(response, 200, { data: { ok: true } });
    }

    if (request.method === "GET" && url.pathname === "/internal/users") {
      return sendJson(response, 200, { data: await listUsers() });
    }

    return notFound(response);
  }),
);

server.listen(port, () => {
  console.log(`auth-service listening on ${port}`);
});
