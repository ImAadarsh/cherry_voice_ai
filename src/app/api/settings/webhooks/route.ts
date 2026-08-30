import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { listWebhooks } from "@/lib/repositories/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/settings/webhooks — webhook log viewer. */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const { searchParams } = new URL(req.url);
  const data = await listWebhooks(restaurantId, {
    source: searchParams.get("source") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: Math.min(200, Number(searchParams.get("limit") ?? 100) || 100),
  });

  return ok({ data, count: data.length });
}
