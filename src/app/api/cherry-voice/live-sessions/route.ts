import { ok } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { listActiveVoiceSessions } from "@/lib/voice/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cherry-voice/live-sessions — active in-memory voice sessions for this tenant */
export async function GET(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;
    const sessions = listActiveVoiceSessions(restaurantId);
    return ok({ sessions });
  } catch (err) {
    return handleRouteError(err);
  }
}
