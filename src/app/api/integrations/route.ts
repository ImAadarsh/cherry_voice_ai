import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/integrations — list account integrations. */
export async function GET(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.integrations.list();
    return ok(result);
  } catch (err) {
    return fail(`Failed to list integrations: ${(err as Error).message}`, 502);
  }
}
