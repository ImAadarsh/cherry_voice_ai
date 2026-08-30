import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { syncAllFromOmnidim } from "@/lib/services/omnidim-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const result = await syncAllFromOmnidim(restaurantId);
  return ok(result);
}
