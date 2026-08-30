import "server-only";
import type { ResultSetHeader } from "mysql2/promise";
import { pool, query } from "../db";

/** Upsert a call log by Omnidim call id. Returns the internal call_logs.id. */
export async function upsertCallLog(input: {
  restaurantId: number;
  agentId?: number | null;
  customerId?: number | null;
  omnidimCallId?: string | null;
  direction?: "inbound" | "outbound";
  fromNumber?: string | null;
  toNumber?: string | null;
  status?: string;
  transcript?: string | null;
  summary?: string | null;
  durationSeconds?: number | null;
  raw?: unknown;
}): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO call_logs
       (restaurant_id, agent_id, customer_id, omnidim_call_id, direction, from_number, to_number,
        status, transcript, summary, duration_seconds, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status), transcript = COALESCE(VALUES(transcript), transcript),
       summary = COALESCE(VALUES(summary), summary),
       duration_seconds = COALESCE(VALUES(duration_seconds), duration_seconds),
       customer_id = COALESCE(VALUES(customer_id), customer_id),
       raw_payload = VALUES(raw_payload)`,
    [
      input.restaurantId,
      input.agentId ?? null,
      input.customerId ?? null,
      input.omnidimCallId ?? null,
      input.direction ?? "inbound",
      input.fromNumber ?? null,
      input.toNumber ?? null,
      input.status ?? "completed",
      input.transcript ?? null,
      input.summary ?? null,
      input.durationSeconds ?? null,
      input.raw ? JSON.stringify(input.raw) : null,
    ],
  );
  // insertId is 0 on pure update; look it up when needed.
  if (res.insertId) return res.insertId;
  if (input.omnidimCallId) {
    const rows = await query<{ id: number } & import("mysql2").RowDataPacket>(
      "SELECT id FROM call_logs WHERE omnidim_call_id = ? LIMIT 1",
      [input.omnidimCallId],
    );
    return rows[0]?.id ?? 0;
  }
  return 0;
}

export async function listCalls(restaurantId: number, limit = 50) {
  return query(
    `SELECT id, omnidim_call_id, direction, from_number, to_number, status,
            duration_seconds, summary, created_at
       FROM call_logs WHERE restaurant_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    [restaurantId, limit],
  );
}
