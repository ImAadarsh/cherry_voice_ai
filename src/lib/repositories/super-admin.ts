import "server-only";
import type { ResultSetHeader } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

export async function listAllUsers(opts?: {
  restaurantId?: number;
  role?: string;
  search?: string;
  limit?: number;
}) {
  const limit = Math.min(opts?.limit ?? 100, 500);
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (opts?.restaurantId) {
    where.push("u.restaurant_id = ?");
    params.push(opts.restaurantId);
  }
  if (opts?.role) {
    where.push("u.role = ?");
    params.push(opts.role);
  }
  if (opts?.search) {
    where.push("(u.name LIKE ? OR u.email LIKE ?)");
    const like = `%${opts.search}%`;
    params.push(like, like);
  }
  params.push(limit);

  return query(
    `SELECT u.id, u.restaurant_id, u.name, u.email, u.role, u.phone, u.is_active,
            u.last_login_at, u.created_at,
            r.name AS restaurant_name, r.slug AS restaurant_slug
       FROM users u
       JOIN restaurants r ON r.id = u.restaurant_id
      WHERE ${where.join(" AND ")}
      ORDER BY u.created_at DESC
      LIMIT ?`,
    params,
  );
}

export async function listAllOrders(opts?: {
  restaurantId?: number;
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}) {
  const limit = Math.min(opts?.limit ?? 100, 500);
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (opts?.restaurantId) {
    where.push("o.restaurant_id = ?");
    params.push(opts.restaurantId);
  }
  if (opts?.status) {
    where.push("o.status = ?");
    params.push(opts.status);
  }
  if (opts?.paymentStatus) {
    where.push("o.payment_status = ?");
    params.push(opts.paymentStatus);
  }
  if (opts?.dateFrom) {
    where.push("o.created_at >= ?");
    params.push(opts.dateFrom);
  }
  if (opts?.dateTo) {
    where.push("o.created_at <= ?");
    params.push(opts.dateTo);
  }
  if (opts?.search) {
    where.push("(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)");
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }
  params.push(limit);

  return query(
    `SELECT o.*, r.name AS restaurant_name, r.slug AS restaurant_slug
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
      WHERE ${where.join(" AND ")}
      ORDER BY o.created_at DESC
      LIMIT ?`,
    params,
  );
}

export async function listAllAgents(opts?: { restaurantId?: number; limit?: number }) {
  const limit = Math.min(opts?.limit ?? 200, 500);
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (opts?.restaurantId) {
    where.push("a.restaurant_id = ?");
    params.push(opts.restaurantId);
  }
  params.push(limit);

  return query(
    `SELECT a.*, r.name AS restaurant_name, r.slug AS restaurant_slug,
            (SELECT COUNT(*) FROM call_logs c WHERE c.agent_id = a.id) AS call_count
       FROM omnidim_agents a
       JOIN restaurants r ON r.id = a.restaurant_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.created_at DESC
      LIMIT ?`,
    params,
  );
}

export async function listAllCalls(opts?: {
  restaurantId?: number;
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(opts?.limit ?? 100, 500);
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (opts?.restaurantId) {
    where.push("c.restaurant_id = ?");
    params.push(opts.restaurantId);
  }
  if (opts?.status) {
    where.push("c.status = ?");
    params.push(opts.status);
  }
  params.push(limit);

  return query(
    `SELECT c.id, c.restaurant_id, c.omnidim_call_id, c.direction, c.from_number, c.to_number,
            c.status, c.duration_seconds, c.summary, c.transcript, c.created_at,
            r.name AS restaurant_name, r.slug AS restaurant_slug,
            a.name AS agent_name
       FROM call_logs c
       JOIN restaurants r ON r.id = c.restaurant_id
       LEFT JOIN omnidim_agents a ON a.id = c.agent_id
      WHERE ${where.join(" AND ")}
      ORDER BY c.created_at DESC
      LIMIT ?`,
    params,
  );
}

export async function getRestaurantById(id: number) {
  return queryOne(
    `SELECT r.*,
            (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.id) AS user_count,
            (SELECT COUNT(*) FROM menu_items m WHERE m.restaurant_id = r.id) AS menu_count,
            (SELECT COUNT(*) FROM omnidim_agents a WHERE a.restaurant_id = r.id) AS agent_count,
            (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id) AS order_count,
            (SELECT COUNT(*) FROM call_logs c WHERE c.restaurant_id = r.id) AS call_count,
            COALESCE((SELECT SUM(total_amount) FROM orders o
               WHERE o.restaurant_id = r.id AND o.payment_status = 'paid'), 0) AS revenue_total
       FROM restaurants r
      WHERE r.id = ?
      LIMIT 1`,
    [id],
  );
}

export async function updateRestaurant(
  id: number,
  patch: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    status?: "active" | "suspended" | "trial" | "closed";
    city?: string | null;
    country?: string | null;
    currency?: string;
  },
): Promise<boolean> {
  const fields: string[] = [];
  const params: unknown[] = [];

  for (const [key, val] of Object.entries(patch)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      params.push(val);
    }
  }
  if (fields.length === 0) return false;

  params.push(id);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE restaurants SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );
  return res.affectedRows > 0;
}

export async function getPlatformAnalytics() {
  const overview = await queryOne<{
    restaurants: number;
    restaurants_active: number;
    restaurants_trial: number;
    restaurants_suspended: number;
    users: number;
    orders: number;
    orders_today: number;
    revenue_total: number;
    revenue_today: number;
    calls: number;
    calls_today: number;
    customers: number;
    agents: number;
  }>(
    `SELECT
        (SELECT COUNT(*) FROM restaurants) AS restaurants,
        (SELECT COUNT(*) FROM restaurants WHERE status = 'active') AS restaurants_active,
        (SELECT COUNT(*) FROM restaurants WHERE status = 'trial') AS restaurants_trial,
        (SELECT COUNT(*) FROM restaurants WHERE status = 'suspended') AS restaurants_suspended,
        (SELECT COUNT(*) FROM users WHERE role != 'super_admin') AS users,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE()) AS orders_today,
        COALESCE((SELECT SUM(total_amount) FROM orders WHERE payment_status = 'paid'), 0) AS revenue_total,
        COALESCE((SELECT SUM(total_amount) FROM orders
           WHERE payment_status = 'paid' AND DATE(created_at) = CURDATE()), 0) AS revenue_today,
        (SELECT COUNT(*) FROM call_logs) AS calls,
        (SELECT COUNT(*) FROM call_logs WHERE DATE(created_at) = CURDATE()) AS calls_today,
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM omnidim_agents) AS agents`,
  );

  const topRestaurants = await query(
    `SELECT r.id, r.name, r.slug, r.status,
            COUNT(o.id) AS order_count,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount END), 0) AS revenue
       FROM restaurants r
       LEFT JOIN orders o ON o.restaurant_id = r.id
      GROUP BY r.id
      ORDER BY revenue DESC, order_count DESC
      LIMIT 10`,
  );

  const ordersTrend = await query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS orders,
            COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount END), 0) AS revenue
       FROM orders
      WHERE created_at >= (CURDATE() - INTERVAL 13 DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
  );

  return { overview, topRestaurants, ordersTrend };
}

export async function findRestaurantOwner(restaurantId: number) {
  return queryOne<{ id: number; email: string; name: string }>(
    `SELECT id, email, name FROM users
      WHERE restaurant_id = ? AND role = 'owner' AND is_active = 1
      ORDER BY id ASC LIMIT 1`,
    [restaurantId],
  );
}

export async function logPlatformAudit(input: {
  actorUserId?: number | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
}) {
  await pool.query(
    `INSERT INTO platform_audit_log (actor_user_id, action, target_type, target_id, metadata, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.actorUserId ?? null,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.ipAddress ?? null,
    ],
  );
}

export async function getSuperAdminKpis() {
  return queryOne<{
    restaurants: number;
    active_agents: number;
    calls_today: number;
    orders_today: number;
    revenue_today: number;
    revenue_total: number;
    customers: number;
  }>(
    `SELECT
        (SELECT COUNT(*) FROM restaurants) AS restaurants,
        (SELECT COUNT(*) FROM omnidim_agents) AS active_agents,
        (SELECT COUNT(*) FROM call_logs WHERE DATE(created_at) = CURDATE()) AS calls_today,
        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE()) AS orders_today,
        COALESCE((SELECT SUM(total_amount) FROM orders
           WHERE payment_status = 'paid' AND DATE(created_at) = CURDATE()), 0) AS revenue_today,
        COALESCE((SELECT SUM(total_amount) FROM orders WHERE payment_status = 'paid'), 0) AS revenue_total,
        (SELECT COUNT(*) FROM customers) AS customers`,
  );
}

export async function getSignupsOverTime(days = 30) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  return query<{ day: string; count: number }>(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM restaurants
      WHERE created_at >= (CURDATE() - INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
    [safeDays - 1],
  );
}

export async function getCallsVolume(days = 14) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  return query<{ day: string; calls: number }>(
    `SELECT DATE(created_at) AS day, COUNT(*) AS calls
       FROM call_logs
      WHERE created_at >= (CURDATE() - INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
    [safeDays - 1],
  );
}

export async function getOrdersByRestaurant(limit = 10) {
  return query<{ restaurant_name: string; orders: number; revenue: number }>(
    `SELECT r.name AS restaurant_name,
            COUNT(o.id) AS orders,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount END), 0) AS revenue
       FROM restaurants r
       LEFT JOIN orders o ON o.restaurant_id = r.id
      GROUP BY r.id, r.name
      ORDER BY revenue DESC, orders DESC
      LIMIT ?`,
    [limit],
  );
}

export async function getPlatformActivity(limit = 15) {
  return query(
    `(SELECT 'order' AS type, o.id AS ref_id, o.restaurant_id, r.name AS restaurant_name,
             CONCAT('Order ', o.order_number) AS summary, o.created_at
        FROM orders o
        JOIN restaurants r ON r.id = o.restaurant_id
       ORDER BY o.created_at DESC
       LIMIT ?)
     UNION ALL
     (SELECT 'call' AS type, c.id AS ref_id, c.restaurant_id, r.name AS restaurant_name,
             CONCAT(UPPER(c.direction), ' call ', COALESCE(c.from_number, '')) AS summary, c.created_at
        FROM call_logs c
        JOIN restaurants r ON r.id = c.restaurant_id
       ORDER BY c.created_at DESC
       LIMIT ?)
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit, limit, limit],
  );
}
