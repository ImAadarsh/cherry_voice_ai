import "server-only";
import type { ResultSetHeader } from "mysql2/promise";
import { pool, query } from "../db";

export type MessageChannel = "sms" | "whatsapp" | "email";
export type MessageStatus = "sent" | "failed" | "simulated" | "skipped";

export async function logMessage(input: {
  restaurantId?: number | null;
  orderId?: number | null;
  customerId?: number | null;
  channel: MessageChannel;
  destination: string;
  body?: string | null;
  provider?: string;
  status: MessageStatus;
  providerRef?: string | null;
  errorMessage?: string | null;
  metadata?: unknown;
}): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO message_logs
       (restaurant_id, order_id, customer_id, channel, destination, body, provider, status, provider_ref, error_message, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.restaurantId ?? null,
      input.orderId ?? null,
      input.customerId ?? null,
      input.channel,
      input.destination,
      input.body ?? null,
      input.provider ?? "stub",
      input.status,
      input.providerRef ?? null,
      input.errorMessage ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
  return res.insertId;
}

export async function listMessageLogs(
  restaurantId: number,
  opts?: { orderId?: number; limit?: number },
) {
  const where = ["restaurant_id = ?"];
  const params: unknown[] = [restaurantId];
  if (opts?.orderId) {
    where.push("order_id = ?");
    params.push(opts.orderId);
  }
  params.push(opts?.limit ?? 50);
  return query(
    `SELECT * FROM message_logs WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    params,
  );
}
