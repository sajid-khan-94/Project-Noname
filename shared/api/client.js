function normalizeBaseUrl(baseUrl = "") {
  if (!baseUrl) return "";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function createApiClient({ baseUrl = "", tokenKey }) {
  const apiBaseUrl = normalizeBaseUrl(baseUrl);

  function getToken() {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(tokenKey) ?? "";
  }

  function setToken(token) {
    if (typeof window === "undefined") return;
    if (token) {
      window.localStorage.setItem(tokenKey, token);
    } else {
      window.localStorage.removeItem(tokenKey);
    }
  }

  async function request(path, options = {}) {
    const token = getToken();
    const response = await fetch(`${apiBaseUrl}${path}`, {
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

  return {
    getToken,
    setToken,
    request,
    async registerUser(form) {
      const data = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setToken(data.token);
      return data.user;
    },
    async loginUser(form) {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setToken(data.token);
      return data.user;
    },
    fetchSession() {
      return request("/api/auth/session");
    },
    async logoutUser() {
      try {
        await request("/api/auth/logout", { method: "POST" });
      } finally {
        setToken("");
      }
    },
    fetchCuisines() {
      return request("/api/cuisines");
    },
    fetchMenuItems({ cuisine = "all", search = "" } = {}) {
      const params = new URLSearchParams();
      if (cuisine && cuisine !== "all") params.set("cuisine", cuisine);
      if (search.trim()) params.set("search", search.trim());
      const query = params.toString();
      return request(`/api/menu-items${query ? `?${query}` : ""}`);
    },
    fetchPublicPaymentGateways() {
      return request("/api/payment-gateways");
    },
    createOrder(payload) {
      return request("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    fetchMyOrders() {
      return request("/api/orders/my");
    },
    fetchAdminOrders() {
      return request("/api/admin/orders");
    },
    advanceAdminOrder(orderId) {
      return request(`/api/admin/orders/${orderId}/advance`, {
        method: "POST",
      });
    },
    fetchAdminCuisines() {
      return request("/api/admin/cuisines");
    },
    saveAdminCuisine(payload) {
      return request("/api/admin/cuisines", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    deleteAdminCuisine(cuisineId) {
      return request(`/api/admin/cuisines/${cuisineId}`, {
        method: "DELETE",
      });
    },
    fetchAdminUsers() {
      return request("/api/admin/users");
    },
    fetchAdminPromos() {
      return request("/api/admin/promos");
    },
    saveAdminPromo(payload) {
      return request("/api/admin/promos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    deleteAdminPromo(promoId) {
      return request(`/api/admin/promos/${promoId}`, {
        method: "DELETE",
      });
    },
    fetchAdminLiveOrders() {
      return request("/api/admin/orders/live");
    },
    fetchAdminOrderMetrics() {
      return request("/api/admin/orders/metrics");
    },
    fetchAdminBilling() {
      return request("/api/admin/billing");
    },
    fetchAdminRefunds() {
      return request("/api/admin/refunds");
    },
    createAdminRefund(payload) {
      return request("/api/admin/refunds", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    fetchAdminPaymentGateways() {
      return request("/api/admin/payment-gateways");
    },
    saveAdminPaymentGateway(payload) {
      return request("/api/admin/payment-gateways", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    deleteAdminPaymentGateway(gatewayId) {
      return request(`/api/admin/payment-gateways/${gatewayId}`, {
        method: "DELETE",
      });
    },
  };
}
