import { ok, fail } from "@/lib/http";
import { getSessionFromRequest } from "@/lib/auth";
import { getRestaurant } from "@/lib/repositories/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) return fail("Not authenticated", 401);
  const restaurant = await getRestaurant(session.restaurantId);
  return ok({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
    restaurant,
    restaurantId: session.restaurantId,
  });
}
