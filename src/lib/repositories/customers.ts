import "server-only";
import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool, queryOne } from "../db";

/**
 * Find an existing customer by phone (unique per restaurant) or create one.
 * Accepts an optional transaction connection so it can run inside order creation.
 */
export async function upsertCustomerByPhone(
  restaurantId: number,
  data: { phone: string; name?: string | null; email?: string | null; address?: string | null },
  conn?: PoolConnection,
): Promise<number> {
  const runner = conn ?? pool;

  const [existing] = await runner.query<RowDataPacket[]>(
    "SELECT id FROM customers WHERE restaurant_id = ? AND phone = ? LIMIT 1",
    [restaurantId, data.phone],
  );

  if (existing.length > 0) {
    const id = existing[0].id as number;
    await runner.query(
      `UPDATE customers
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             default_address = COALESCE(?, default_address)
       WHERE id = ?`,
      [data.name ?? null, data.email ?? null, data.address ?? null, id],
    );
    return id;
  }

  const [res] = await runner.query<ResultSetHeader>(
    `INSERT INTO customers (restaurant_id, phone, name, email, default_address)
     VALUES (?, ?, ?, ?, ?)`,
    [restaurantId, data.phone, data.name ?? null, data.email ?? null, data.address ?? null],
  );
  return res.insertId;
}

export async function listCustomers(
  restaurantId: number,
  arg: number | { search?: string; limit?: number } = {},
) {
  const opts = typeof arg === "number" ? { limit: arg } : arg;
  const where: string[] = ["restaurant_id = ?"];
  const params: unknown[] = [restaurantId];
  if (opts.search) {
    where.push("(name LIKE ? OR phone LIKE ? OR email LIKE ?)");
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }
  params.push(opts.limit ?? 100);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, phone, email, default_address, notes, preferences, allergies, tags,
            total_orders, total_spent, loyalty_points, last_order_at, created_at
       FROM customers WHERE ${where.join(" AND ")}
       ORDER BY last_order_at DESC, created_at DESC
       LIMIT ?`,
    params,
  );
  return rows;
}

export async function updateCustomer(
  restaurantId: number,
  id: number,
  patch: {
    name?: string | null;
    email?: string | null;
    notes?: string | null;
    preferences?: string | null;
    allergies?: string[] | null;
    tags?: string[] | null;
  },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    params.push(patch.name);
  }
  if (patch.email !== undefined) {
    sets.push("email = ?");
    params.push(patch.email);
  }
  if (patch.notes !== undefined) {
    sets.push("notes = ?");
    params.push(patch.notes);
  }
  if (patch.preferences !== undefined) {
    sets.push("preferences = ?");
    params.push(patch.preferences);
  }
  if (patch.allergies !== undefined) {
    sets.push("allergies = ?");
    params.push(patch.allergies ? JSON.stringify(patch.allergies) : null);
  }
  if (patch.tags !== undefined) {
    sets.push("tags = ?");
    params.push(patch.tags ? JSON.stringify(patch.tags) : null);
  }
  if (sets.length === 0) return true;
  params.push(id, restaurantId);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE customers SET ${sets.join(", ")} WHERE id = ? AND restaurant_id = ?`,
    params,
  );
  return res.affectedRows > 0;
}

/** Award loyalty points when an order is paid (call only once per order). */
export async function awardLoyaltyPoints(
  customerId: number,
  orderId: number,
  points: number,
): Promise<void> {
  if (points <= 0) return;
  const order = await queryOne<{ metadata: string | null }>(
    "SELECT metadata FROM orders WHERE id = ?",
    [orderId],
  );
  let meta: { loyalty_awarded?: boolean } = {};
  try {
    meta = order?.metadata ? JSON.parse(order.metadata) : {};
  } catch {
    /* ignore */
  }
  if (meta.loyalty_awarded) return;

  await pool.query(`UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?`, [
    points,
    customerId,
  ]);
  await pool.query(
    `UPDATE orders SET metadata = JSON_SET(COALESCE(metadata, '{}'), '$.loyalty_awarded', true) WHERE id = ?`,
    [orderId],
  );
}

export async function getCustomer(restaurantId: number, id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customers WHERE id = ? AND restaurant_id = ? LIMIT 1",
    [id, restaurantId],
  );
  return rows[0] ?? null;
}

/** Recent orders for a customer, used on the customer detail view. */
export async function getCustomerOrders(restaurantId: number, customerId: number, limit = 20) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, order_number, status, payment_status, total_amount, currency, created_at
       FROM orders WHERE restaurant_id = ? AND customer_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    [restaurantId, customerId, limit],
  );
  return rows;
}
