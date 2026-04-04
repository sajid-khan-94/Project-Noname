const TOKEN_KEY = "bkfast-auth-token";

function getToken() {
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

function setToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload.data;
}

export async function registerUser(form) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(form),
  });
  setToken(data.token);
  return data.user;
}

export async function loginUser(form) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(form),
  });
  setToken(data.token);
  return data.user;
}

export function fetchSession() {
  return request("/api/auth/session");
}

export async function logoutUser() {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } finally {
    setToken("");
  }
}

export function fetchCuisines() {
  return request("/api/cuisines");
}

export function fetchMenuItems({ cuisine = "all", search = "" } = {}) {
  const params = new URLSearchParams();
  if (cuisine && cuisine !== "all") params.set("cuisine", cuisine);
  if (search.trim()) params.set("search", search.trim());
  const query = params.toString();
  return request(`/api/menu-items${query ? `?${query}` : ""}`);
}

export function createOrder(payload) {
  return request("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMyOrders() {
  return request("/api/orders/my");
}

export function fetchAdminOrders() {
  return request("/api/admin/orders");
}

export function advanceAdminOrder(orderId) {
  return request(`/api/admin/orders/${orderId}/advance`, {
    method: "POST",
  });
}

export function fetchAdminCuisines() {
  return request("/api/admin/cuisines");
}

export function saveAdminCuisine(payload) {
  return request("/api/admin/cuisines", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminCuisine(cuisineId) {
  return request(`/api/admin/cuisines/${cuisineId}`, {
    method: "DELETE",
  });
}

export function fetchAdminUsers() {
  return request("/api/admin/users");
}

export function fetchAdminPromos() {
  return request("/api/admin/promos");
}

export function saveAdminPromo(payload) {
  return request("/api/admin/promos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPromo(promoId) {
  return request(`/api/admin/promos/${promoId}`, {
    method: "DELETE",
  });
}

export function fetchAdminLiveOrders() {
  return request("/api/admin/orders/live");
}

export function fetchAdminOrderMetrics() {
  return request("/api/admin/orders/metrics");
}

export function fetchAdminBilling() {
  return request("/api/admin/billing");
}

export function fetchAdminRefunds() {
  return request("/api/admin/refunds");
}

export function createAdminRefund(payload) {
  return request("/api/admin/refunds", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminPaymentGateways() {
  return request("/api/admin/payment-gateways");
}

export function saveAdminPaymentGateway(payload) {
  return request("/api/admin/payment-gateways", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPaymentGateway(gatewayId) {
  return request(`/api/admin/payment-gateways/${gatewayId}`, {
    method: "DELETE",
  });
}
