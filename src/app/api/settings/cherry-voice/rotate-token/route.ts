import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { rotateWidgetToken } from "@/lib/repositories/cherry-voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/settings/cherry-voice/rotate-token */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const token = await rotateWidgetToken(restaurantId);
  return ok({ widget_token: token });
}
