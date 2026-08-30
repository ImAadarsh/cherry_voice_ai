import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey, omnidimRawRequest } from "@/lib/omnidim-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/omnidim/simulations/[id]/start */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidimRawRequest(`/simulations/${params.id}/start`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return ok({ result, available: true });
  } catch (err) {
    return fail(`Failed to start simulation: ${(err as Error).message}`, 503);
  }
}
