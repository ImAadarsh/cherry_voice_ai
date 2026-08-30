import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getCherryVoiceAnalytics } from "@/lib/repositories/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cherry-voice/analytics — P2 tool/barge-in analytics */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const url = new URL(req.url);
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days") ?? 7) || 7));

  const analytics = await getCherryVoiceAnalytics(restaurantId, days);
  return ok({ analytics });
}
