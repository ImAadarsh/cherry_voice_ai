import "server-only";
import { execute, query, queryOne } from "../db";
import type { WebhookSource } from "@/types";

interface LogWebhookInput {
  source: WebhookSource;
  eventType?: string | null;
  externalEventId?: string | null;
  restaurantId?: number | null;
  signatureValid?: boolean | null;
  payload?: unknown;
  headers?: Record<string, string> | null;
}

/**
 * Record an inbound webhook. Returns { id, duplicate } — `duplicate` is true if
 * we've already seen this (source, external_event_id), enabling idempotent
 * handlers to short-circuit.
 */
export async function recordWebhook(input: LogWebhookInput): Promise<{ id: number; duplicate: boolean }> {
  if (input.externalEventId) {
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM webhooks_log WHERE source = ? AND external_event_id = ? LIMIT 1",
      [input.source, input.externalEventId],
    );
    if (existing) return { id: existing.id, duplicate: true };
  }

  const res = await execute(
    `INSERT INTO webhooks_log
       (restaurant_id, source, event_type, external_event_id, signature_valid, status, headers, payload)
     VALUES (?, ?, ?, ?, ?, 'received', ?, ?)`,
    [
      input.restaurantId ?? null,
      input.source,
      input.eventType ?? null,
      input.externalEventId ?? null,
      input.signatureValid == null ? null : input.signatureValid ? 1 : 0,
      input.headers ? JSON.stringify(input.headers) : null,
      input.payload ? JSON.stringify(input.payload) : null,
    ],
  );
  return { id: res.insertId, duplicate: false };
}

export async function markWebhook(
  id: number,
  status: "processed" | "failed" | "ignored" | "duplicate",
  opts?: { errorMessage?: string; httpStatus?: number; relatedOrderId?: number; relatedPaymentId?: number; relatedCallId?: number },
): Promise<void> {
  await execute(
    `UPDATE webhooks_log
       SET status = ?, error_message = ?, http_status = ?,
           related_order_id = COALESCE(?, related_order_id),
           related_payment_id = COALESCE(?, related_payment_id),
           related_call_id = COALESCE(?, related_call_id),
           processed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      status,
      opts?.errorMessage ?? null,
      opts?.httpStatus ?? null,
      opts?.relatedOrderId ?? null,
      opts?.relatedPaymentId ?? null,
      opts?.relatedCallId ?? null,
      id,
    ],
  );
}

export async function listWebhooks(
  restaurantId: number,
  opts?: { source?: string; status?: string; limit?: number },
) {
  const where = ["(restaurant_id = ? OR restaurant_id IS NULL)"];
  const params: unknown[] = [restaurantId];
  if (opts?.source) {
    where.push("source = ?");
    params.push(opts.source);
  }
  if (opts?.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  params.push(opts?.limit ?? 100);
  return query(
    `SELECT id, restaurant_id, source, event_type, external_event_id, status,
            signature_valid, http_status, related_order_id, related_payment_id,
            related_call_id, error_message, created_at, processed_at
       FROM webhooks_log
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?`,
    params,
  );
}
