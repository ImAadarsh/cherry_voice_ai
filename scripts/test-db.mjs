import "dotenv/config";
import mysql from "mysql2/promise";

const host = process.env.DB_HOST ?? "127.0.0.1";
const port = Number(process.env.DB_PORT || 3306);

let conn;
try {
  conn = await mysql.createConnection({
    host,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 15000,
  });
} catch (err) {
  const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
  console.error(`Cannot connect to MySQL at ${host}:${port} (${code || "unknown error"})`);
  if (host === "127.0.0.1" || host === "localhost") {
    console.error("Hint: start local MySQL (XAMPP control panel) and run:");
    console.error("  CREATE DATABASE cherry_voice_ai;");
    console.error("  npm run db:migrate && npm run db:seed");
  } else {
    console.error("Hint: remote Hostinger MySQL may be unreachable from your network.");
    console.error("Enable Remote MySQL + IP whitelist in hPanel, or switch .env to local DB.");
  }
  process.exit(1);
}

const [[{ version }]] = await conn.query("SELECT VERSION() AS version");
const [tables] = await conn.query("SHOW TABLES");
console.log(`Connected to ${process.env.DB_NAME} @ ${host}:${port} (${version})`);
console.log(`Tables (${tables.length}):`);
for (const row of tables) console.log("  -", Object.values(row)[0]);

const [[{ items }]] = await conn.query("SELECT COUNT(*) AS items FROM menu_items");
const [[{ r }]] = await conn.query("SELECT COUNT(*) AS r FROM restaurants");
console.log(`Seed check: ${r} restaurant(s), ${items} menu item(s).`);

await conn.end();
