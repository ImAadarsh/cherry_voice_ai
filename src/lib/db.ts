import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { env } from "./env";
import { DatabaseUnavailableError, toDatabaseUnavailableError } from "./db-errors";

/**
 * Shared MySQL/MariaDB connection pool (mysql2).
 *
 * In dev, Next.js hot-reloads modules which would otherwise create a new pool
 * on every change and exhaust connections. We cache the pool on `globalThis`.
 */
declare global {
  // eslint-disable-next-line no-var
  var __cherryDbPool: Pool | undefined;
}

function createPool(): Pool {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    // Return DECIMAL/BIGINT as JS numbers where safe; keep big ids as strings.
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
  });
}

export const pool: Pool = global.__cherryDbPool ?? createPool();
if (env.NODE_ENV !== "production") {
  global.__cherryDbPool = pool;
}

async function runQuery<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toDatabaseUnavailableError(err);
  }
}

/**
 * Run a parameterised query and get typed rows back.
 * @example const rows = await query<Order>("SELECT * FROM orders WHERE id = ?", [id]);
 */
export async function query<T = RowDataPacket>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  return runQuery(async () => {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as T[];
  });
}

/** Run a write (INSERT/UPDATE/DELETE) and get the result header. */
export async function execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
  return runQuery(async () => {
    const [result] = await pool.query<ResultSetHeader>(sql, params);
    return result;
  });
}

/** Fetch a single row or null. */
export async function queryOne<T = RowDataPacket>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Run a set of statements inside a transaction. The callback receives a
 * dedicated connection; rolls back automatically on throw.
 */
export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    if (conn) await conn.rollback();
    throw toDatabaseUnavailableError(err);
  } finally {
    conn?.release();
  }
}

export type DatabaseStatus = "connected" | "unreachable";

/** Lightweight health check used by /api/health. */
export async function pingDatabase(): Promise<{
  status: DatabaseStatus;
  error?: string;
}> {
  try {
    const rows = await query("SELECT 1 AS ok");
    return { status: rows.length > 0 ? "connected" : "unreachable" };
  } catch (err) {
    const message =
      err instanceof DatabaseUnavailableError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Database unreachable";
    return { status: "unreachable", error: message };
  }
}
