import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/omnidim/phone-numbers/search */
export async function GET(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const { searchParams } = new URL(req.url);
  const region = (searchParams.get("region") ?? "US") as "IN" | "US";
  const page = Number(searchParams.get("page") ?? 1) || 1;
  const limit = Number(searchParams.get("limit") ?? 20) || 20;

  try {
    const result = await omnidim.phoneNumbers.search({ region, page, limit });
    return ok(result);
  } catch (err) {
    return fail(`Failed to search numbers: ${(err as Error).message}`, 502);
  }
}
