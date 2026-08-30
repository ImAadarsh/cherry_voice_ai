import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/omnidim/providers/voices/[id] — voice detail + sample URL. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const voice = await omnidim.providers.getVoice(params.id);
    return ok({ voice });
  } catch (err) {
    return fail(`Failed to fetch voice: ${(err as Error).message}`, 502);
  }
}
