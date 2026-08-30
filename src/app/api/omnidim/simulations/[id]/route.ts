import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey, omnidimRawRequest } from "@/lib/omnidim-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/omnidim/simulations/[id] */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidimRawRequest(`/simulations/${params.id}`);
    return ok({ simulation: result, available: true });
  } catch (err) {
    return fail(`Failed to fetch simulation: ${(err as Error).message}`, 503);
  }
}
