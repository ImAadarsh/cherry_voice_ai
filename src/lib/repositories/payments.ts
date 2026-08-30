import "server-only";
import type { ResultSetHeader } from "mysql2/promise";
import { pool, query, queryOne } from "../db";
import type { PaymentProvider } from "@/types";

export async function createPaymentRecord(input: {
  restaurantId: number;
  orderId: number;
  provider: PaymentProvider;
  providerLinkId?: string | null;
  providerIntentId?: string | null;
  paymentLinkUrl?: string | null;
  amount: number;
  currency: string;
}): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO payments
       (restaurant_id, order_id, provider, provider_intent_id, payment_link_id, payment_link_url,
        amount, currency, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'link_sent')`,
    [
      input.restaurantId,
      input.orderId,
      input.provider,
      input.providerIntentId ?? null,
      input.providerLinkId ?? null,
      input.paymentLinkUrl ?? null,
      input.amount,
      input.currency,
    ],
  );
  return res.insertId;
}

/**
 * Reconcile a payment from a normalized webhook event. Idempotent: matches on
 * provider payment/intent id or order id, updates status + paid_at.
 */
export async function reconcilePayment(input: {
  provider: PaymentProvider;
  status: string;
  providerPaymentId?: string;
  providerIntentId?: string;
  orderId?: number;
  amount?: number;
  method?: string;
  raw?: unknown;
}): Promise<{ paymentId: number | null; orderId: number | null }> {
  let existing = null;

  if (input.providerPaymentId) {
    existing = await queryOne<{ id: number; order_id: number }>(
      "SELECT id, order_id FROM payments WHERE provider = ? AND provider_payment_id = ? LIMIT 1",
      [input.provider, input.providerPaymentId],
    );
  }
  if (!existing && input.providerIntentId) {
    existing = await queryOne<{ id: number; order_id: number }>(
      "SELECT id, order_id FROM payments WHERE provider = ? AND (payment_link_id = ? OR provider_intent_id = ?) LIMIT 1",
      [input.provider, input.providerIntentId, input.providerIntentId],
    );
  }
  if (!existing && input.orderId) {
    existing = await queryOne<{ id: number; order_id: number }>(
      "SELECT id, order_id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1",
      [input.orderId],
    );
  }

  const paidAt = input.status === "paid" ? new Date() : null;

  if (existing) {
    await pool.query(
      `UPDATE payments
         SET status = ?, provider_payment_id = COALESCE(?, provider_payment_id),
             method = COALESCE(?, method), paid_at = COALESCE(?, paid_at),
             raw_payload = ?
       WHERE id = ?`,
      [
        input.status,
        input.providerPaymentId ?? null,
        input.method ?? null,
        paidAt,
        input.raw ? JSON.stringify(input.raw) : null,
        existing.id,
      ],
    );
    return { paymentId: existing.id, orderId: existing.order_id ?? input.orderId ?? null };
  }

  // No prior record (e.g. link created out-of-band) — create one if we know the order.
  if (input.orderId) {
    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO payments
         (restaurant_id, order_id, provider, provider_payment_id, provider_intent_id, amount, currency, status, method, paid_at, raw_payload)
       SELECT restaurant_id, ?, ?, ?, ?, ?, currency, ?, ?, ?, ?
         FROM orders WHERE id = ?`,
      [
        input.orderId,
        input.provider,
        input.providerPaymentId ?? null,
        input.providerIntentId ?? null,
        input.amount ?? 0,
        input.status,
        input.method ?? null,
        paidAt,
        input.raw ? JSON.stringify(input.raw) : null,
        input.orderId,
      ],
    );
    return { paymentId: res.insertId, orderId: input.orderId };
  }

  return { paymentId: null, orderId: input.orderId ?? null };
}

/** Latest active hosted payment link for an order (not yet paid). */
export async function getActivePaymentLinkForOrder(orderId: number) {
  return queryOne<{ payment_link_url: string; provider: PaymentProvider }>(
    `SELECT payment_link_url, provider FROM payments
      WHERE order_id = ?
        AND payment_link_url IS NOT NULL
        AND status IN ('link_sent', 'pending', 'processing')
      ORDER BY id DESC LIMIT 1`,
    [orderId],
  );
}

export async function listPayments(
  restaurantId: number,
  arg: number | { status?: string; provider?: PaymentProvider; orderId?: number; limit?: number } = {},
) {
  const opts = typeof arg === "number" ? { limit: arg } : arg;
  const where: string[] = ["restaurant_id = ?"];
  const params: unknown[] = [restaurantId];
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts.provider) {
    where.push("provider = ?");
    params.push(opts.provider);
  }
  if (opts.orderId != null) {
    where.push("order_id = ?");
    params.push(opts.orderId);
  }
  params.push(opts.limit ?? 50);
  return query(
    `SELECT * FROM payments WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    params,
  );
}
