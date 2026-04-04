import crypto from "node:crypto";
import { readDomainState, updateDomainState } from "./json-store.js";

const storeName = "payment";

function now() {
  return new Date().toISOString();
}

function createInitialState() {
  return {
    paymentGateways: [
      {
        id: "gateway_stripe",
        name: "Stripe",
        provider: "stripe",
        enabled: true,
        mode: "live",
        supportsRefunds: true,
      },
      {
        id: "gateway_razorpay",
        name: "Razorpay",
        provider: "razorpay",
        enabled: true,
        mode: "test",
        supportsRefunds: true,
      },
    ],
    payments: [],
    refunds: [],
  };
}

export function listPaymentGateways({ onlyEnabled = false } = {}) {
  return readDomainState(storeName, createInitialState).then((state) =>
    state.paymentGateways.filter((gateway) => !onlyEnabled || gateway.enabled),
  );
}

export async function upsertPaymentGateway(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const id = payload?.id?.trim() || `gateway_${crypto.randomUUID().slice(0, 8)}`;
    const name = payload?.name?.trim();
    const provider = payload?.provider?.trim().toLowerCase();
    const mode = payload?.mode?.trim() || "test";
    const enabled = payload?.enabled !== false;
    const supportsRefunds = payload?.supportsRefunds !== false;

    if (!name || !provider) {
      throw new Error("Gateway name and provider are required.");
    }

    const gateway = { id, name, provider, mode, enabled, supportsRefunds };
    const index = state.paymentGateways.findIndex((entry) => entry.id === id);
    if (index >= 0) state.paymentGateways[index] = gateway;
    else state.paymentGateways.push(gateway);
    return gateway;
  });
}

export async function deletePaymentGateway(id) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    state.paymentGateways = state.paymentGateways.filter((entry) => entry.id !== id);
    return true;
  });
}

export async function initializePayment(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const paymentMethod = payload?.paymentMethod?.trim() || "card";
    const record = {
      id: `pay_${crypto.randomUUID().slice(0, 8)}`,
      orderId: payload?.orderId,
      userId: payload?.userId,
      gatewayId: paymentMethod === "card" ? payload?.gatewayId?.trim() || null : null,
      amount: Number(payload?.amount ?? 0),
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "pending" : "authorized",
      createdAt: now(),
      history: [
        {
          at: now(),
          status: paymentMethod === "cod" ? "pending" : "authorized",
          note: paymentMethod === "cod" ? "Awaiting cash collection." : "Payment authorized.",
        },
      ],
    };
    state.payments.unshift(record);
    return record;
  });
}

export async function listPayments() {
  const state = await readDomainState(storeName, createInitialState);
  return state.payments;
}

export async function listRefunds() {
  const state = await readDomainState(storeName, createInitialState);
  return state.refunds;
}

export async function createRefund(payload) {
  return updateDomainState(storeName, createInitialState, async (state) => {
    const orderId = payload?.orderId?.trim();
    const reason = payload?.reason?.trim();
    if (!orderId || !reason) {
      throw new Error("Order id and refund reason are required.");
    }

    const payment = state.payments.find((entry) => entry.orderId === orderId);
    if (!payment) {
      throw new Error("Payment record not found.");
    }

    const amount = Number(payload?.amount ?? payment.amount);
    const refund = {
      id: `refund_${crypto.randomUUID().slice(0, 8)}`,
      orderId,
      amount,
      reason,
      status: "processed",
      createdAt: now(),
    };

    payment.paymentStatus = "refunded";
    payment.history.push({
      at: now(),
      status: "refunded",
      note: `Refunded ${amount}. Reason: ${reason}`,
    });
    state.refunds.unshift(refund);
    return refund;
  });
}

export async function getBillingSummary() {
  const state = await readDomainState(storeName, createInitialState);
  const grossRevenue = state.payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const refundedAmount = state.refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
  return {
    grossRevenue,
    refundedAmount,
    netRevenue: grossRevenue - refundedAmount,
    refundCount: state.refunds.length,
    paidOrders: state.payments.filter((entry) => entry.paymentStatus === "authorized" || entry.paymentStatus === "captured").length,
  };
}
