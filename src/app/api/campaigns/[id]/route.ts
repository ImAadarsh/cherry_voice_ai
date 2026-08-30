import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/campaigns/[id] — campaign detail. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.bulkCalls.get(params.id);
    return ok(result);
  } catch (err) {
    return fail(`Failed to fetch campaign: ${(err as Error).message}`, 502);
  }
}

/** DELETE /api/campaigns/[id] — cancel campaign. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.bulkCalls.cancel(params.id);
    return ok(result);
  } catch (err) {
    return fail(`Failed to cancel campaign: ${(err as Error).message}`, 502);
  }
}
