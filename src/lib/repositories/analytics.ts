import "server-only";
import { queryOne, query } from "../db";

/** Headline metrics for the dashboard overview. */
export async function getOverview(restaurantId: number) {
  const totals = await queryOne<{
    orders_today: number;
    revenue_today: number;
    orders_total: number;
    revenue_total: number;
  }>(
    `SELECT
        SUM(DATE(created_at) = CURDATE()) AS orders_today,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND payment_status = 'paid' THEN total_amount END), 0) AS revenue_today,
        COUNT(*) AS orders_total,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount END), 0) AS revenue_total
     FROM orders WHERE restaurant_id = ?`,
    [restaurantId],
  );

  const customers = await queryOne<{ c: number }>(
    "SELECT COUNT(*) AS c FROM customers WHERE restaurant_id = ?",
    [restaurantId],
  );

  const calls = await queryOne<{ c: number }>(
    "SELECT COUNT(*) AS c FROM call_logs WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()",
    [restaurantId],
  );

  const activeCalls = await queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM call_logs
      WHERE restaurant_id = ? AND status IN ('initiated','ringing','in_progress')`,
    [restaurantId],
  );

  const pendingPayments = await queryOne<{ c: number; amount: number }>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS amount
       FROM payments
      WHERE restaurant_id = ? AND status IN ('link_sent','processing','pending')`,
    [restaurantId],
  );

  const yesterday = await queryOne<{ orders: number; revenue: number }>(
    `SELECT
        SUM(DATE(created_at) = CURDATE() - INTERVAL 1 DAY) AS orders,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY AND payment_status = 'paid' THEN total_amount END), 0) AS revenue
     FROM orders WHERE restaurant_id = ?`,
    [restaurantId],
  );

  const byStatus = await query(
    `SELECT status, COUNT(*) AS count FROM orders WHERE restaurant_id = ? GROUP BY status`,
    [restaurantId],
  );

  return {
    ordersToday: Number(totals?.orders_today ?? 0),
    revenueToday: Number(totals?.revenue_today ?? 0),
    ordersYesterday: Number(yesterday?.orders ?? 0),
    revenueYesterday: Number(yesterday?.revenue ?? 0),
    ordersTotal: Number(totals?.orders_total ?? 0),
    revenueTotal: Number(totals?.revenue_total ?? 0),
    customers: Number(customers?.c ?? 0),
    callsToday: Number(calls?.c ?? 0),
    activeCalls: Number(activeCalls?.c ?? 0),
    pendingPayments: Number(pendingPayments?.c ?? 0),
    pendingAmount: Number(pendingPayments?.amount ?? 0),
    ordersByStatus: byStatus,
  };
}

/** Last N days revenue trend (paid orders). */
export async function getRevenueTrend(restaurantId: number, days = 14) {
  const safeDays = Math.min(Math.max(days, 7), 90);
  return query(
    `SELECT DATE(created_at) AS day,
            COUNT(*) AS orders,
            COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount END), 0) AS revenue
       FROM orders
      WHERE restaurant_id = ? AND created_at >= (CURDATE() - INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
    [restaurantId, safeDays - 1],
  );
}

/** Orders grouped by hour (last 7 days). */
export async function getOrdersByHour(restaurantId: number) {
  return query(
    `SELECT HOUR(created_at) AS hour, COUNT(*) AS orders
       FROM orders
      WHERE restaurant_id = ? AND created_at >= (CURDATE() - INTERVAL 6 DAY)
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC`,
    [restaurantId],
  );
}

/** Top-selling menu items (last 30 days). */
export async function getTopMenuItems(restaurantId: number, limit = 8) {
  return query(
    `SELECT oi.name,
            SUM(oi.quantity) AS qty,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = ? AND o.created_at >= (CURDATE() - INTERVAL 30 DAY)
      GROUP BY oi.name
      ORDER BY qty DESC
      LIMIT ?`,
    [restaurantId, limit],
  );
}

/** Call volume and average duration. */
export async function getCallMetrics(restaurantId: number) {
  const today = await queryOne<{ c: number; avg: number }>(
    `SELECT COUNT(*) AS c, COALESCE(AVG(duration_seconds), 0) AS avg
       FROM call_logs
      WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()`,
    [restaurantId],
  );
  const week = await queryOne<{ c: number; avg: number }>(
    `SELECT COUNT(*) AS c, COALESCE(AVG(duration_seconds), 0) AS avg
       FROM call_logs
      WHERE restaurant_id = ? AND created_at >= (CURDATE() - INTERVAL 6 DAY)`,
    [restaurantId],
  );
  return {
    callsToday: Number(today?.c ?? 0),
    avgDurationToday: Number(today?.avg ?? 0),
    callsWeek: Number(week?.c ?? 0),
    avgDurationWeek: Number(week?.avg ?? 0),
  };
}

/** Payment success rate (last 30 days). */
export async function getPaymentSuccessRate(restaurantId: number) {
  const row = await queryOne<{ total: number; paid: number }>(
    `SELECT COUNT(*) AS total,
            SUM(status = 'paid') AS paid
       FROM payments
      WHERE restaurant_id = ? AND created_at >= (CURDATE() - INTERVAL 30 DAY)`,
    [restaurantId],
  );
  const total = Number(row?.total ?? 0);
  const paid = Number(row?.paid ?? 0);
  return {
    total,
    paid,
    rate: total > 0 ? Math.round((paid / total) * 1000) / 10 : 0,
  };
}

/** Simple revenue forecast from historical daily averages (next 7 days). */
export async function getRevenueForecast(restaurantId: number, days = 30) {
  const history = await query<{ day: string; revenue: number; orders: number }>(
    `SELECT DATE(created_at) AS day,
            COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount END), 0) AS revenue,
            COUNT(*) AS orders
       FROM orders
      WHERE restaurant_id = ? AND created_at >= (CURDATE() - INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
    [restaurantId, days],
  );

  const revenues = history.map((r) => Number(r.revenue));
  const avgRevenue =
    revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;
  const avgOrders =
    history.length > 0
      ? history.reduce((s, r) => s + Number(r.orders), 0) / history.length
      : 0;

  const forecast: Array<{ day: string; label: string; revenue: number; orders: number; projected: boolean }> = [];

  for (const row of history) {
    const d = new Date(String(row.day));
    forecast.push({
      day: String(row.day),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: Number(row.revenue),
      orders: Number(row.orders),
      projected: false,
    });
  }

  const lastDate = history.length
    ? new Date(String(history[history.length - 1].day))
    : new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    const sameDow = history.filter((h) => new Date(String(h.day)).getDay() === dayOfWeek);
    const dowAvg =
      sameDow.length > 0
        ? sameDow.reduce((s, r) => s + Number(r.revenue), 0) / sameDow.length
        : avgRevenue;
    forecast.push({
      day: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: Math.round(dowAvg * 0.85 + avgRevenue * 0.15),
      orders: Math.round(avgOrders),
      projected: true,
    });
  }

  return { history, forecast, avgRevenue: Math.round(avgRevenue), avgOrders: Math.round(avgOrders) };
}
