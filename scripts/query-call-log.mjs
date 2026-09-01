#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

const callId = process.argv[2];
if (!callId) {
  console.error("Usage: node scripts/query-call-log.mjs <omnidim_call_id>");
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await conn.query(
  `SELECT id, omnidim_call_id, source, status, tool_calls, transcript_json, turn_metrics, metadata
   FROM call_logs WHERE omnidim_call_id = ? LIMIT 1`,
  [callId],
);

console.log(JSON.stringify(rows, null, 2));
await conn.end();
