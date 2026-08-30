import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { listKitchenOrders, getOrderItemsForOrders } from "@/lib/repositories/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/kitchen/orders — active orders for kitchen display (polling). */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const rows = await listKitchenOrders(restaurantId);
  const itemMap = await getOrderItemsForOrders(rows.map((r) => Number(r.id)));
  const data = rows.map((o) => ({
    ...o,
    items: itemMap.get(Number(o.id)) ?? [],
  }));

  return ok({ data, count: data.length, polledAt: new Date().toISOString() });
}
