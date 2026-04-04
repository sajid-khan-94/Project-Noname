import { URL } from "node:url";

const defaultHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

export function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { ...defaultHeaders, ...headers });
  response.end(JSON.stringify(payload));
}

export function sendEmpty(response, status = 204, headers = {}) {
  response.writeHead(status, { ...defaultHeaders, ...headers });
  response.end();
}

export function notFound(response) {
  return sendJson(response, 404, { error: "Not found" });
}

export function unauthorized(response) {
  return sendJson(response, 401, { error: "Unauthorized" });
}

export function badRequest(response, message) {
  return sendJson(response, 400, { error: message });
}

export function serverError(response, error) {
  return sendJson(response, 500, { error: error?.message ?? "Internal server error" });
}

export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function getUrl(request) {
  return new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
}

export function getBearerToken(request) {
  const authHeader = request.headers.authorization ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

export async function handleRequest(response, handler) {
  try {
    await handler();
  } catch (error) {
    serverError(response, error);
  }
}
