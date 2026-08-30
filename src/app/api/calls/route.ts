import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { listCalls } from "@/lib/repositories/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calls
 * List recent call logs for the restaurant (most recent first).
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50) || 50));
  const data = await listCalls(restaurantId, limit);
  return ok({ data, count: data.length });
}
