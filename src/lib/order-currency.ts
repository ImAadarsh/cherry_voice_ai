import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { queryOne } from "./db";

/** Load ISO-4217 currency for a restaurant. */
export async function getRestaurantCurrency(restaurantId: number): Promise<string | null> {
  const row = await queryOne<{ currency: string }>(
    "SELECT currency FROM restaurants WHERE id = ? LIMIT 1",
    [restaurantId],
  );
  return row?.currency ? String(row.currency).toUpperCase() : null;
}

async function getRestaurantCurrencyConn(
  conn: PoolConnection,
  restaurantId: number,
): Promise<string | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT currency FROM restaurants WHERE id = ? LIMIT 1",
    [restaurantId],
  );
  const currency = rows[0]?.currency;
  return currency ? String(currency).toUpperCase() : null;
}

/** Resolve currency from matched menu rows (first non-empty wins). */
function currencyFromMenuRows(rows: RowDataPacket[]): string | null {
  for (const row of rows) {
    const c = row.currency;
    if (c && String(c).trim()) return String(c).toUpperCase();
  }
  return null;
}

/**
 * Resolve currency when creating an order: explicit input → restaurant → menu
 * items → USD fallback.
 */
export async function resolveOrderCurrency(
  restaurantId: number,
  opts?: {
    explicit?: string | null;
    conn?: PoolConnection;
    itemSkus?: Array<string | null | undefined>;
    itemNames?: Array<string | null | undefined>;
  },
): Promise<string> {
  if (opts?.explicit?.trim()) return opts.explicit.trim().toUpperCase();

  const skus = (opts?.itemSkus ?? []).filter(Boolean) as string[];
  const names = (opts?.itemNames ?? []).filter(Boolean) as string[];

  if (opts?.conn && (skus.length > 0 || names.length > 0)) {
    const clauses: string[] = [];
    const params: unknown[] = [restaurantId];
    if (skus.length > 0) {
      clauses.push(`sku IN (${skus.map(() => "?").join(",")})`);
      params.push(...skus);
    }
    if (names.length > 0) {
      clauses.push(`name IN (${names.map(() => "?").join(",")})`);
      params.push(...names);
    }
    const [menuRows] = await opts.conn.query<RowDataPacket[]>(
      `SELECT currency FROM menu_items
         WHERE restaurant_id = ? AND (${clauses.join(" OR ")})
         LIMIT 20`,
      params,
    );
    const menuCurrency = currencyFromMenuRows(menuRows);
    if (menuCurrency) return menuCurrency;
  }

  const restaurantCurrency = opts?.conn
    ? await getRestaurantCurrencyConn(opts.conn, restaurantId)
    : await getRestaurantCurrency(restaurantId);
  if (restaurantCurrency) return restaurantCurrency;

  return "USD";
}

/**
 * Currency for payment links. Prefer restaurant currency when the order still
 * carries the schema default USD (common when voice orders omit currency).
 */
export async function resolvePaymentCurrency(
  orderCurrency: string | null | undefined,
  restaurantId: number,
): Promise<string> {
  const restaurantCurrency = await getRestaurantCurrency(restaurantId);
  const order = orderCurrency?.trim().toUpperCase();

  if (order && order !== "USD") return order;
  if (restaurantCurrency) return restaurantCurrency;
  return order ?? "USD";
}
