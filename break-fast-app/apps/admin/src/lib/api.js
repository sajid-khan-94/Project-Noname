import { createApiClient } from "@shared/api/client.js";

const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  tokenKey: "bkfast-admin-token",
});

export const {
  loginUser,
  logoutUser,
  fetchSession,
  fetchAdminOrders,
  advanceAdminOrder,
  fetchAdminCuisines,
  saveAdminCuisine,
  deleteAdminCuisine,
  fetchAdminUsers,
  fetchAdminPromos,
  saveAdminPromo,
  deleteAdminPromo,
  fetchAdminLiveOrders,
  fetchAdminOrderMetrics,
  fetchAdminBilling,
  fetchAdminRefunds,
  createAdminRefund,
  fetchAdminPaymentGateways,
  saveAdminPaymentGateway,
  deleteAdminPaymentGateway,
} = api;
