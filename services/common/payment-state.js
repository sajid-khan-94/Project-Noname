import crypto from "node:crypto";
import { createPostgresStore } from "./postgres.js";

const database = createPostgresStore({
  connectionString: process.env.DATABASE_URL ?? "postgresql://bkfast:bkfast@localhost:5432/payment_db",
  schemaStatements: [
    `CREATE TABLE IF NOT EXISTS payment_gateways (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      mode TEXT NOT NULL,
      supports_refunds BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      gateway_id TEXT,
      amount NUMERIC(12, 2) NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payment_history (
      id BIGSERIAL PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )`,
  ],
  seed: async (client) => {
    const gateways = [
      ["gateway_stripe", "Stripe", "stripe", true, "live", true],
      ["gateway_razorpay", "Razorpay", "razorpay", true, "test", true],
    ];

    for (const gateway of gateways) {
      await client.query(
        `INSERT INTO payment_gateways (id, name, provider, enabled, mode, supports_refunds, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO NOTHING`,
        gateway,
      );
    }
  },
});

function mapGateway(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    enabled: row.enabled,
    mode: row.mode,
    supportsRefunds: row.supports_refunds,
  };
}

async function loadPaymentHistory(client, paymentIds) {
  if (!paymentIds.length) return new Map();

  const historyResult = await client.query(
    `SELECT payment_id, status, note, created_at
     FROM payment_history
     WHERE payment_id = ANY($1::text[])
     ORDER BY created_at ASC`,
    [paymentIds],
  );

  const historyMap = new Map();
  for (const row of historyResult.rows) {
    const list = historyMap.get(row.payment_id) ?? [];
    list.push({
      at: row.created_at,
      status: row.status,
      note: row.note,
    });
    historyMap.set(row.payment_id, list);
  }

  return historyMap;
}

export async function listPaymentGateways({ onlyEnabled = false } = {}) {
  const result = await database.query(
    `SELECT id, name, provider, enabled, mode, supports_refunds
     FROM payment_gateways
     ${onlyEnabled ? "WHERE enabled = TRUE" : ""}
     ORDER BY provider ASC, name ASC`,
  );
  return result.rows.map(mapGateway);
}

export async function upsertPaymentGateway(payload) {
  const id = payload?.id?.trim() || `gateway_${crypto.randomUUID().slice(0, 8)}`;
  const name = payload?.name?.trim();
  const provider = payload?.provider?.trim().toLowerCase();
  const mode = payload?.mode?.trim() || "test";
  const enabled = payload?.enabled !== false;
  const supportsRefunds = payload?.supportsRefunds !== false;

  if (!name || !provider) {
    throw new Error("Gateway name and provider are required.");
  }

  const result = await database.query(
    `INSERT INTO payment_gateways (id, name, provider, enabled, mode, supports_refunds, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       provider = EXCLUDED.provider,
       enabled = EXCLUDED.enabled,
       mode = EXCLUDED.mode,
       supports_refunds = EXCLUDED.supports_refunds
     RETURNING id, name, provider, enabled, mode, supports_refunds`,
    [id, name, provider, enabled, mode, supportsRefunds],
  );

  return mapGateway(result.rows[0]);
}

export async function deletePaymentGateway(id) {
  await database.query(`DELETE FROM payment_gateways WHERE id = $1`, [id]);
  return true;
}

export async function initializePayment(payload) {
  const paymentMethod = payload?.paymentMethod?.trim() || "card";
  const paymentStatus = paymentMethod === "cod" ? "pending" : "authorized";
  const note = paymentMethod === "cod" ? "Awaiting cash collection." : "Payment authorized.";
  const paymentId = `pay_${crypto.randomUUID().slice(0, 8)}`;

  return database.transaction(async (client) => {
    const paymentResult = await client.query(
      `INSERT INTO payments (id, order_id, user_id, gateway_id, amount, payment_method, payment_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, order_id, user_id, gateway_id, amount, payment_method, payment_status, created_at`,
      [
        paymentId,
        payload?.orderId,
        payload?.userId,
        paymentMethod === "card" ? payload?.gatewayId?.trim() || null : null,
        Number(payload?.amount ?? 0),
        paymentMethod,
        paymentStatus,
      ],
    );

    await client.query(
      `INSERT INTO payment_history (payment_id, status, note, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [paymentId, paymentStatus, note],
    );

    return {
      id: paymentResult.rows[0].id,
      orderId: paymentResult.rows[0].order_id,
      userId: paymentResult.rows[0].user_id,
      gatewayId: paymentResult.rows[0].gateway_id,
      amount: Number(paymentResult.rows[0].amount),
      paymentMethod: paymentResult.rows[0].payment_method,
      paymentStatus,
      createdAt: paymentResult.rows[0].created_at,
      history: [{ at: paymentResult.rows[0].created_at, status: paymentStatus, note }],
    };
  });
}

export async function listPayments() {
  return database.transaction(async (client) => {
    const paymentResult = await client.query(
      `SELECT id, order_id, user_id, gateway_id, amount, payment_method, payment_status, created_at
       FROM payments
       ORDER BY created_at DESC`,
    );
    const historyMap = await loadPaymentHistory(
      client,
      paymentResult.rows.map((row) => row.id),
    );

    return paymentResult.rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      gatewayId: row.gateway_id,
      amount: Number(row.amount),
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
      history: historyMap.get(row.id) ?? [],
    }));
  });
}

export async function listRefunds() {
  const result = await database.query(
    `SELECT id, order_id, amount, reason, status, created_at
     FROM refunds
     ORDER BY created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    amount: Number(row.amount),
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function createRefund(payload) {
  const orderId = payload?.orderId?.trim();
  const reason = payload?.reason?.trim();

  if (!orderId || !reason) {
    throw new Error("Order id and refund reason are required.");
  }

  return database.transaction(async (client) => {
    const paymentResult = await client.query(
      `SELECT id, amount FROM payments WHERE order_id = $1`,
      [orderId],
    );
    const payment = paymentResult.rows[0];
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
    };

    await client.query(
      `INSERT INTO refunds (id, order_id, amount, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [refund.id, refund.orderId, refund.amount, refund.reason, refund.status],
    );
    await client.query(
      `UPDATE payments SET payment_status = 'refunded' WHERE order_id = $1`,
      [orderId],
    );
    await client.query(
      `INSERT INTO payment_history (payment_id, status, note, created_at)
       VALUES ($1, 'refunded', $2, NOW())`,
      [payment.id, `Refunded ${amount}. Reason: ${reason}`],
    );

    return {
      ...refund,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function getBillingSummary() {
  const paymentsResult = await database.query(
    `SELECT payment_status, amount FROM payments`,
  );
  const refundsResult = await database.query(
    `SELECT amount FROM refunds`,
  );

  const grossRevenue = paymentsResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const refundedAmount = refundsResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    grossRevenue,
    refundedAmount,
    netRevenue: grossRevenue - refundedAmount,
    refundCount: refundsResult.rows.length,
    paidOrders: paymentsResult.rows.filter(
      (row) => row.payment_status === "authorized" || row.payment_status === "captured",
    ).length,
  };
}
