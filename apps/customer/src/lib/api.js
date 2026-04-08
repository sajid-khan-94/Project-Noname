import { createApiClient } from "@shared/api/client.js";

const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  tokenKey: "bkfast-customer-token",
});

export const {
  registerUser,
  loginUser,
  logoutUser,
  fetchSession,
  fetchCuisines,
  fetchMenuItems,
  fetchPublicPaymentGateways,
  createOrder,
  fetchMyOrders,
} = api;
