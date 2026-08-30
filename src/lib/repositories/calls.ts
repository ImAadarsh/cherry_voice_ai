import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

export type CallLogSource = "platform" | "cherry_voice";

export type TranscriptEntry = {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
};

export type ToolCallEntry = {
  name: string;
  args: unknown;
  result: unknown;
  timestamp: string;
};

/** Upsert a call log by Omnidim call id. Returns the internal call_logs.id. */
export async function upsertCallLog(input: {
  restaurantId: number;
  agentId?: number | null;
  customerId?: number | null;
  omnidimCallId?: string | null;
  source?: CallLogSource;
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
       (restaurant_id, agent_id, customer_id, omnidim_call_id, source, direction, from_number, to_number,
        status, transcript, summary, duration_seconds, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status), transcript = COALESCE(VALUES(transcript), transcript),
       summary = COALESCE(VALUES(summary), summary),
       duration_seconds = COALESCE(VALUES(duration_seconds), duration_seconds),
       customer_id = COALESCE(VALUES(customer_id), customer_id),
       raw_payload = VALUES(raw_payload),
       source = VALUES(source)`,
    [
      input.restaurantId,
      input.agentId ?? null,
      input.customerId ?? null,
      input.omnidimCallId ?? null,
      input.source ?? "platform",
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
  if (res.insertId) return res.insertId;
  if (input.omnidimCallId) {
    const rows = await query<{ id: number } & RowDataPacket>(
      "SELECT id FROM call_logs WHERE omnidim_call_id = ? LIMIT 1",
      [input.omnidimCallId],
    );
    return rows[0]?.id ?? 0;
  }
  return 0;
}

/** Create a Cherry Voice call log row when a browser session starts. */
export async function createCherryVoiceCallLog(input: {
  restaurantId: number;
  sessionId: string;
  agentId?: number | null;
  voiceId?: string | null;
}): Promise<number> {
  const metadata = {
    voice_id: input.voiceId ?? null,
    session_id: input.sessionId,
  };

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO call_logs
       (restaurant_id, agent_id, omnidim_call_id, source, direction, status, started_at,
        transcript_json, tool_calls, raw_payload)
     VALUES (?, ?, ?, 'cherry_voice', 'inbound', 'in_progress', CURRENT_TIMESTAMP, ?, ?, ?)`,
    [
      input.restaurantId,
      input.agentId ?? null,
      input.sessionId,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify(metadata),
    ],
  );
  return res.insertId;
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatTranscriptText(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => `${e.role === "user" ? "Customer" : "Agent"}: ${e.text}`)
    .join("\n\n");
}

export async function appendCherryVoiceTranscript(
  callLogId: number,
  entry: TranscriptEntry,
): Promise<void> {
  const row = await queryOne<{ transcript_json: unknown } & RowDataPacket>(
    "SELECT transcript_json FROM call_logs WHERE id = ? LIMIT 1",
    [callLogId],
  );
  if (!row) return;

  const entries = parseJsonArray<TranscriptEntry>(row.transcript_json);
  entries.push(entry);

  await pool.query(
    `UPDATE call_logs
        SET transcript_json = ?, transcript = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [JSON.stringify(entries), formatTranscriptText(entries), callLogId],
  );
}

export async function appendCherryVoiceToolCall(
  callLogId: number,
  entry: ToolCallEntry,
): Promise<void> {
  const row = await queryOne<{ tool_calls: unknown } & RowDataPacket>(
    "SELECT tool_calls FROM call_logs WHERE id = ? LIMIT 1",
    [callLogId],
  );
  if (!row) return;

  const entries = parseJsonArray<ToolCallEntry>(row.tool_calls);
  entries.push(entry);

  await pool.query(
    "UPDATE call_logs SET tool_calls = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [JSON.stringify(entries), callLogId],
  );
}

export async function completeCherryVoiceCallLog(
  callLogId: number,
  input: {
    status: "completed" | "failed";
    startedAtMs: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const durationSeconds = Math.max(0, Math.round((Date.now() - input.startedAtMs) / 1000));
  const row = await queryOne<{ raw_payload: unknown } & RowDataPacket>(
    "SELECT raw_payload FROM call_logs WHERE id = ? LIMIT 1",
    [callLogId],
  );

  let raw: Record<string, unknown> = {};
  if (row?.raw_payload) {
    if (typeof row.raw_payload === "object") raw = row.raw_payload as Record<string, unknown>;
    else {
      try {
        raw = JSON.parse(String(row.raw_payload)) as Record<string, unknown>;
      } catch {
        raw = {};
      }
    }
  }
  if (input.metadata) {
    raw = { ...raw, ...input.metadata };
  }

  await pool.query(
    `UPDATE call_logs
        SET status = ?, ended_at = CURRENT_TIMESTAMP, duration_seconds = ?,
            raw_payload = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [input.status === "completed" ? "completed" : "failed", durationSeconds, JSON.stringify(raw), callLogId],
  );
}

export async function getCallLogByExternalId(restaurantId: number, externalId: string) {
  const numericId = /^\d+$/.test(externalId) ? Number(externalId) : null;
  return queryOne(
    `SELECT c.*, a.name AS agent_name
       FROM call_logs c
       LEFT JOIN omnidim_agents a ON a.id = c.agent_id
      WHERE c.restaurant_id = ?
        AND (c.omnidim_call_id = ? OR c.id = ?)
      LIMIT 1`,
    [restaurantId, externalId, numericId ?? 0],
  );
}

export async function listCalls(restaurantId: number, limit = 50) {
  return query(
    `SELECT c.id, c.omnidim_call_id, c.source, c.direction, c.from_number, c.to_number,
            c.status, c.duration_seconds, c.summary, c.started_at, c.created_at,
            c.agent_id, a.name AS agent_name
       FROM call_logs c
       LEFT JOIN omnidim_agents a ON a.id = c.agent_id
      WHERE c.restaurant_id = ?
      ORDER BY COALESCE(c.started_at, c.created_at) DESC
      LIMIT ?`,
    [restaurantId, limit],
  );
}
