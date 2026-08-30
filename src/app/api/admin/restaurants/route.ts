import { ok } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/route-auth";
import { getPlatformStats, listAllRestaurants } from "@/lib/repositories/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/restaurants — platform admin: all tenants. */
export async function GET(req: Request) {
  const session = await requirePlatformAdmin(req);
  if (session instanceof Response) return session;

  const [restaurants, stats] = await Promise.all([listAllRestaurants(), getPlatformStats()]);
  return ok({ restaurants, stats });
}
