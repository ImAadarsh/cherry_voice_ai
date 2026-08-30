import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { omnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/campaigns/[id]/live-status */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.bulkCalls.liveStatus(params.id);
    return ok(result);
  } catch (err) {
    return fail(`Failed to fetch live status: ${(err as Error).message}`, 502);
  }
}
