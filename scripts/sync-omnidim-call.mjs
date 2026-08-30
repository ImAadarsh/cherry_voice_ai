#!/usr/bin/env node
/**
 * Fetch a single Omnidim call log and upsert it into call_logs.
 *
 * Usage: node scripts/sync-omnidim-call.mjs --call-id=7218436 [--restaurant-id=4]
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import OmniDimension from "@omnidim-ai/sdk";

function parseArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=") ?? null;
}

async function getDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function main() {
  const callId = parseArg("call-id");
  if (!callId) throw new Error("Pass --call-id=<omnidim_call_log_id>");

  const omnidim = new OmniDimension({ apiKey: process.env.OMNIDIM_API_KEY });
  const result = await omnidim.calls.getLog(callId);
  const log = (result.call_log_data ?? [])[0];
  if (!log) throw new Error(`Call ${callId} not found`);

  console.log("Call:", log.id, log.bot_name, log.call_status);
  console.log("Duration:", log.call_duration_in_seconds, "s");

  const toolCalls = (log.interactions ?? [])
    .flatMap((i) => i.function_call_data ?? [])
    .filter(Boolean);
  for (const tc of toolCalls) {
    console.log(
      `  tool ${tc.function_name}: ${tc.success ? "OK" : "FAIL"} —`,
      tc.result?.integration ?? tc.result?.message ?? "",
    );
  }

  const conn = await getDb();
  try {
    let restaurantId = parseArg("restaurant-id");
    let agentLocalId = null;

    const [agents] = await conn.query(
      "SELECT id, restaurant_id, omnidim_agent_id, name FROM omnidim_agents WHERE name LIKE ? OR omnidim_agent_id = ? LIMIT 1",
      [`%${(log.bot_name ?? "").replace(" Voice Agent", "")}%`, String(log.agent_id ?? "")],
    );
    if (agents[0]) {
      restaurantId = restaurantId ?? String(agents[0].restaurant_id);
      agentLocalId = agents[0].id;
      console.log(`Mapped to restaurant ${restaurantId}, local agent ${agentLocalId}`);
    }

    if (!restaurantId) {
      const [byName] = await conn.query(
        "SELECT id FROM restaurants WHERE name LIKE ? LIMIT 1",
        [`%${(log.bot_name ?? "").replace(/ Voice Agent$/i, "")}%`],
      );
      restaurantId = byName[0]?.id ? String(byName[0].id) : null;
    }

    if (!restaurantId) {
      const [restaurants] = await conn.query("SELECT id, name FROM restaurants LIMIT 10");
      console.log("Could not infer restaurant. Pass --restaurant-id=. Available:", restaurants);
      process.exit(1);
    }

    const [restaurantCheck] = await conn.query("SELECT id FROM restaurants WHERE id = ? LIMIT 1", [
      restaurantId,
    ]);
    if (!restaurantCheck[0]) {
      console.error(
        `Restaurant id ${restaurantId} not in this database. Point DB_* in .env to the same DB as your dev server, or create the restaurant first.`,
      );
      process.exit(1);
    }

    const transcript = stripHtml(log.call_conversation);
    const [res] = await conn.query(
      `INSERT INTO call_logs
         (restaurant_id, agent_id, omnidim_call_id, direction, from_number, to_number,
          status, transcript, summary, duration_seconds, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         transcript = COALESCE(VALUES(transcript), transcript),
         duration_seconds = COALESCE(VALUES(duration_seconds), duration_seconds),
         raw_payload = VALUES(raw_payload)`,
      [
        restaurantId,
        agentLocalId,
        String(log.id),
        log.call_direction === "outbound" ? "outbound" : "inbound",
        log.from_number ?? null,
        log.to_number ?? null,
        log.call_status ?? "completed",
        transcript || null,
        null,
        log.call_duration_in_seconds ?? null,
        JSON.stringify(log),
      ],
    );

    const callLogId = res.insertId || (
      await conn.query("SELECT id FROM call_logs WHERE omnidim_call_id = ? LIMIT 1", [String(log.id)])
    )[0][0]?.id;

    console.log(`Upserted call_logs id=${callLogId ?? "?"}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
