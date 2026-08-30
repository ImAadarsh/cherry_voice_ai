#!/usr/bin/env node
/**
 * List and bulk-delete duplicate voice agents for a restaurant.
 *
 * Usage:
 *   node scripts/cleanup-duplicate-agents.mjs --restaurant-id=1 [--dry-run]
 *
 * Requires DB_* env vars (loads .env from project root).
 */
import mysql from "mysql2/promise";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const restaurantId = Number(args["restaurant-id"]);
const dryRun = args["dry-run"] === "true";

if (!Number.isFinite(restaurantId)) {
  console.error("Usage: node scripts/cleanup-duplicate-agents.mjs --restaurant-id=ID [--dry-run]");
  process.exit(1);
}

const pool = await mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "cherry_voice_ai",
});

const [duplicates] = await pool.query(
  `SELECT name, COUNT(*) AS count
     FROM omnidim_agents
    WHERE restaurant_id = ?
    GROUP BY name
   HAVING COUNT(*) > 1`,
  [restaurantId],
);

if (!duplicates.length) {
  console.log(`No duplicate agent names for restaurant ${restaurantId}.`);
  await pool.end();
  process.exit(0);
}

console.log(`Duplicate names for restaurant ${restaurantId}:`);
for (const row of duplicates) {
  console.log(`  - ${row.name}: ${row.count} agents`);
}

const toDelete = [];
for (const dup of duplicates) {
  const [rows] = await pool.query(
    `SELECT id, name, omnidim_agent_id, created_at
       FROM omnidim_agents
      WHERE restaurant_id = ? AND name = ?
      ORDER BY created_at DESC`,
    [restaurantId, dup.name],
  );
  console.log(`\nKeeping newest for "${dup.name}" (#${rows[0].id})`);
  for (const row of rows.slice(1)) {
    toDelete.push(row);
    console.log(`  ${dryRun ? "Would delete" : "Deleting"} #${row.id} (${row.omnidim_agent_id})`);
  }
}

if (dryRun) {
  console.log(`\nDry run: ${toDelete.length} agent(s) would be removed.`);
  await pool.end();
  process.exit(0);
}

for (const row of toDelete) {
  await pool.query(
    "DELETE FROM omnidim_agent_integrations WHERE restaurant_id = ? AND omnidim_agent_id = ?",
    [restaurantId, row.omnidim_agent_id],
  );
  await pool.query("DELETE FROM omnidim_agents WHERE id = ? AND restaurant_id = ?", [
    row.id,
    restaurantId,
  ]);
}

console.log(`\nRemoved ${toDelete.length} duplicate local mapping(s).`);
console.log("Note: remote voice platform agents are not deleted by this script.");
await pool.end();
