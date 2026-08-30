#!/usr/bin/env node
/**
 * Simple, dependency-light migration runner.
 *
 * Usage:
 *   node database/migrate.mjs           # apply schema migrations (001, ...)
 *   node database/migrate.mjs --seed    # also apply seed files (002_seed_*, *seed*)
 *   node database/migrate.mjs --fresh   # DROP ALL TABLES first, then migrate (DANGER)
 *
 * Reads DB creds from .env. Applies any *.sql file in database/migrations/ in
 * lexical order that has not yet been recorded in `schema_migrations`.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const args = new Set(process.argv.slice(2));
const runSeed = args.has("--seed");
const fresh = args.has("--fresh");

function requiredEnv(name) {
  const v = process.env[name];
  if (v == null || v === "") {
    if (name === "DB_PASSWORD") return "";
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const conn = await mysql.createConnection({
    host: requiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT || 3306),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    multipleStatements: true,
    connectTimeout: 20000,
  });

  console.log(`Connected to ${process.env.DB_NAME} @ ${process.env.DB_HOST}`);

  if (fresh) {
    console.log("--fresh: dropping all tables ...");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    const [rows] = await conn.query(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?",
      [process.env.DB_NAME],
    );
    for (const { t } of rows) {
      await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  // Ensure the tracking table exists so we can read applied versions.
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [applied] = await conn.query("SELECT version FROM schema_migrations");
  const appliedSet = new Set(applied.map((r) => r.version));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const isSeed = /seed/i.test(file);
    if (isSeed && !runSeed) {
      console.log(`- skip ${file} (seed; pass --seed to apply)`);
      continue;
    }
    if (appliedSet.has(version) && !fresh) {
      console.log(`- skip ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`- apply ${file} ... `);
    await conn.query(sql);
    console.log("done");
    count++;
  }

  console.log(`\nMigration complete. Applied ${count} file(s).`);
  await conn.end();
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
