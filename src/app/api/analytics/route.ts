import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getRestaurant } from "@/lib/repositories/settings";
import {
  getOverview,
  getRevenueTrend,
  getOrdersByHour,
  getTopMenuItems,
  getCallMetrics,
  getPaymentSuccessRate,
  getRevenueForecast,
} from "@/lib/repositories/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? 14);
  const extended = url.searchParams.get("extended") === "1";

  const [overview, trend, restaurant] = await Promise.all([
    getOverview(restaurantId),
    getRevenueTrend(restaurantId, days),
    getRestaurant(restaurantId),
  ]);

  const currency = String(restaurant?.currency ?? "USD");

  if (!extended) {
    return ok({ overview, trend, currency });
  }

  const [ordersByHour, topMenuItems, callMetrics, paymentSuccess, forecast] =
    await Promise.all([
      getOrdersByHour(restaurantId),
      getTopMenuItems(restaurantId),
      getCallMetrics(restaurantId),
      getPaymentSuccessRate(restaurantId),
      getRevenueForecast(restaurantId, days),
    ]);

  return ok({
    overview,
    trend,
    currency,
    ordersByHour,
    topMenuItems,
    callMetrics,
    paymentSuccess,
    forecast,
  });
}
