import { ok } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { getCherryVoiceErrorStats } from "@/lib/repositories/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cherry-voice/voice-errors — rolling TTS/STT error counts */
export async function GET(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;
    const url = new URL(req.url);
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days") ?? 7)));
    const stats = await getCherryVoiceErrorStats(restaurantId, days);
    return ok(stats);
  } catch (err) {
    return handleRouteError(err);
  }
}
