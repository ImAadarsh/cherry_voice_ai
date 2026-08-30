import { ok, fail } from "@/lib/http";
import { env } from "@/lib/env";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { getOmnidim } from "@/lib/omnidim";
import { requireRestaurantId } from "@/lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  if (!(await isOmnidimConfigured())) return fail("Voice AI platform is not configured. Contact support.", 503);
  const { searchParams } = new URL(req.url);
  const pagesize = Math.min(100, Number(searchParams.get("pagesize") ?? 50) || 50);
  try {
    const numbers = await omnidim.phoneNumbers.list({ pagesize });
    return ok(numbers);
  } catch (err) {
    return fail(`Failed to list phone numbers: ${(err as Error).message}`, 502);
  }
}
