import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getTopMenuItems } from "@/lib/repositories/analytics";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/menu/suggestions — top sellers + upsell tips from sales data. */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const topSellers = await getTopMenuItems(restaurantId, 5);

  const pairs = await query<{ a: string; b: string; count: number }>(
    `SELECT oi1.name AS a, oi2.name AS b, COUNT(DISTINCT oi1.order_id) AS count
       FROM order_items oi1
       JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.id < oi2.id
       JOIN orders o ON o.id = oi1.order_id
      WHERE o.restaurant_id = ? AND o.created_at >= (CURDATE() - INTERVAL 30 DAY)
      GROUP BY oi1.name, oi2.name
      HAVING count >= 2
      ORDER BY count DESC
      LIMIT 5`,
    [restaurantId],
  );

  const upsellTips = pairs.map((p) => ({
    tip: `Customers who order "${p.a}" often add "${p.b}"`,
    confidence: Number(p.count),
  }));

  if (upsellTips.length === 0 && topSellers.length > 0) {
    const top = String(topSellers[0].name);
    upsellTips.push({
      tip: `Suggest "${top}" as a popular upsell — it's your #1 seller this month`,
      confidence: Number(topSellers[0].qty),
    });
  }

  return ok({ topSellers, upsellTips });
}
