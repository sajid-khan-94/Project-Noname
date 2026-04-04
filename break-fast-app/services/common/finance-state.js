import crypto from "node:crypto";
import {
  cuisines as seededCuisines,
  findCuisineLabel,
  menuItems as seededMenuItems,
} from "../../server/data.js";
import { readDomainState, updateDomainState } from "./json-store.js";

const storeName = "finance";
const orderSteps = ["pending_payment", "payment_authorized", "preparing", "out_for_delivery", "delivered"];

function now() {
  return new Date().toISOString();
}

function createInitialState() {
  return {
    cuisines: seededCuisines.map((cuisine) => ({ ...cuisine })),
    menuItems: seededMenuItems.map((item) => ({ ...item })),
    promoCodes: [],
    orders: [],
  };
}

function nextStatus(current) {
  const index = orderSteps.indexOf(current);
  return index === -1 || index === orderSteps.length - 1 ? current : orderSteps[index + 1];
}

function summarizeItems(state, cartItems = []) {
  const items = cartItems
    .map((cartItem) => {
      const menuItem = state.menuItems.find((entry) => entry.id === Number(cartItem.itemId));
      if (!menuItem) return null;
      const quantity = Math.max(1, Number(cartItem.quantity) || 1);
      return {
        itemId: menuItem.id,
        name: menuItem.name,
        cuisine: menuItem.cuisine,
        cuisineLabel: state.cuisines.find((entry) => entry.id === menuItem.cuisine)?.label ?? findCuisineLabel(menuItem.cuisine),
        quantity,
        unitPrice: menuItem.price,
        lineTotal: menuItem.price * quantity,
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = items.length ? 39 : 0;
  const platformFee = items.length ? 12 : 0;
  return {
    items,
    subtotal,
    deliveryFee,
    platformFee,
    total: subtotal + deliveryFee + platformFee,
  };
}

export function listCuisines({ includeDisabled = false } = {}) {
  return readDomainState(storeName, createInitialState).then((state) =>
    state.cuisines.filter((entry) => includeDisabled || entry.enabled),
  );
}

export async function upsertCuisine(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const id = payload?.id?.trim().toLowerCase();
    const label = payload?.label?.trim();
    const thumbnail = payload?.thumbnail?.trim() || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80";
    const enabled = payload?.enabled !== false;

    if (!id || !label) {
      throw new Error("Cuisine id and label are required.");
    }

    const cuisine = { id, label, thumbnail, enabled };
    const index = state.cuisines.findIndex((entry) => entry.id === id);
    if (index >= 0) state.cuisines[index] = cuisine;
    else state.cuisines.push(cuisine);
    return cuisine;
  });
}

export async function deleteCuisine(id) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    if (!id || id === "all") {
      throw new Error("This cuisine cannot be removed.");
    }
    state.cuisines = state.cuisines.filter((entry) => entry.id !== id);
    state.menuItems = state.menuItems.filter((entry) => entry.cuisine !== id);
    state.promoCodes = state.promoCodes.map((promo) => ({
      ...promo,
      cuisineIds: promo.cuisineIds.filter((entry) => entry !== id),
    }));
    return true;
  });
}

export async function listMenuItems({ cuisine = "all", search = "" } = {}) {
  const state = await readDomainState(storeName, createInitialState);
  const allowed = new Set(state.cuisines.filter((entry) => entry.enabled).map((entry) => entry.id));
  const term = search.trim().toLowerCase();

  return state.menuItems.filter((item) => {
    const matchesCuisine = cuisine === "all" || !cuisine || item.cuisine === cuisine;
    const matchesSearch =
      !term ||
      item.name.toLowerCase().includes(term) ||
      item.desc.toLowerCase().includes(term) ||
      item.cuisine.toLowerCase().includes(term);
    return allowed.has(item.cuisine) && matchesCuisine && matchesSearch;
  });
}

export async function createOrder(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const user = payload?.user;
    const customer = payload?.customer;
    const paymentMethod = payload?.paymentMethod?.trim() || "card";

    if (!user?.id) {
      throw new Error("Authenticated user is required.");
    }
    if (!customer?.name?.trim() || !customer?.phone?.trim() || !customer?.address?.trim()) {
      throw new Error("Customer name, phone, and delivery address are required.");
    }

    const summary = summarizeItems(state, payload?.items ?? []);
    if (!summary.items.length) {
      throw new Error("Order must include at least one valid item.");
    }

    const order = {
      id: `ord_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      status: paymentMethod === "cod" ? "pending_payment" : "payment_authorized",
      paymentStatus: paymentMethod === "cod" ? "pending" : "authorized",
      paymentMethod,
      gatewayId: payload?.gatewayId?.trim() || null,
      etaMinutes: 28,
      createdAt: now(),
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        address: customer.address.trim(),
      },
      ...summary,
    };

    state.orders.unshift(order);
    return order;
  });
}

export async function listOrders({ userId = null, limit = 20 } = {}) {
  const state = await readDomainState(storeName, createInitialState);
  return state.orders.filter((entry) => !userId || entry.userId === userId).slice(0, limit);
}

export async function listLiveOrders() {
  const liveStatuses = new Set(["payment_authorized", "preparing", "out_for_delivery"]);
  const orders = await listOrders({ limit: 200 });
  return orders.filter((order) => liveStatuses.has(order.status));
}

export async function getOrderMetrics() {
  const orders = await listOrders({ limit: 1000 });
  const liveStatuses = new Set(["payment_authorized", "preparing", "out_for_delivery"]);
  return {
    totalOrders: orders.length,
    deliveredOrders: orders.filter((order) => order.status === "delivered").length,
    liveOrders: orders.filter((order) => liveStatuses.has(order.status)).length,
    totalRevenue: orders.filter((order) => order.paymentStatus !== "refunded").reduce((sum, order) => sum + order.total, 0),
  };
}

export async function advanceOrderStatus(orderId) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const order = state.orders.find((entry) => entry.id === orderId);
    if (!order) return null;
    order.status = nextStatus(order.status);
    order.paymentStatus =
      order.status === "delivered"
        ? "captured"
        : order.status === "pending_payment"
          ? order.paymentStatus
          : "authorized";
    return order;
  });
}

export async function syncOrderPaymentStatus(orderId, paymentStatus) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const order = state.orders.find((entry) => entry.id === orderId);
    if (!order) return null;
    order.paymentStatus = paymentStatus;
    return order;
  });
}

export async function listPromoCodes() {
  const state = await readDomainState(storeName, createInitialState);
  return state.promoCodes;
}

export async function upsertPromoCode(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const code = payload?.code?.trim().toUpperCase();
    const title = payload?.title?.trim();
    const discountPercent = Number(payload?.discountPercent ?? 0);
    const cuisineIds = Array.isArray(payload?.cuisineIds) ? payload.cuisineIds.filter(Boolean) : [];
    const enabled = payload?.enabled !== false;
    const id = payload?.id?.trim() || `promo_${crypto.randomUUID().slice(0, 8)}`;

    if (!code || !title || !discountPercent || cuisineIds.length === 0) {
      throw new Error("Promo code, title, discount percent, and cuisines are required.");
    }

    const promo = { id, code, title, discountPercent, cuisineIds, enabled };
    const index = state.promoCodes.findIndex((entry) => entry.id === id || entry.code === code);
    if (index >= 0) state.promoCodes[index] = promo;
    else state.promoCodes.push(promo);
    return promo;
  });
}

export async function deletePromoCode(id) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    state.promoCodes = state.promoCodes.filter((entry) => entry.id !== id);
    return true;
  });
}
