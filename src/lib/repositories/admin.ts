import "server-only";
import { query, queryOne } from "../db";

/** List all restaurants for platform admin dashboard. */
export async function listAllRestaurants() {
  return query(
    `SELECT r.id, r.name, r.slug, r.email, r.phone, r.city, r.country, r.currency,
            r.status, r.created_at,
            (SELECT u.name FROM users u WHERE u.restaurant_id = r.id AND u.role = 'owner' LIMIT 1) AS owner_name,
            (SELECT u.email FROM users u WHERE u.restaurant_id = r.id AND u.role = 'owner' LIMIT 1) AS owner_email,
            (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.id) AS user_count,
            (SELECT COUNT(*) FROM omnidim_agents a WHERE a.restaurant_id = r.id) AS agent_count,
            (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id) AS order_count,
            (SELECT COUNT(*) FROM call_logs c WHERE c.restaurant_id = r.id) AS call_count,
            COALESCE((SELECT SUM(total_amount) FROM orders o
               WHERE o.restaurant_id = r.id AND o.payment_status = 'paid'), 0) AS revenue_total
       FROM restaurants r
       ORDER BY r.created_at DESC`,
  );
}

export async function getPlatformStats() {
  return queryOne<{
    restaurants: number;
    orders: number;
    calls: number;
    customers: number;
  }>(
    `SELECT
        (SELECT COUNT(*) FROM restaurants) AS restaurants,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM call_logs) AS calls,
        (SELECT COUNT(*) FROM customers) AS customers`,
  );
}
