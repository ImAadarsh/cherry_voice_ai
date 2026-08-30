import { ok } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { listAllCalls } from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/super-admin/calls — all call logs across tenants. */
export async function GET(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(req.url);
  const calls = await listAllCalls({
    restaurantId: searchParams.get("restaurant_id")
      ? Number(searchParams.get("restaurant_id"))
      : undefined,
    status: searchParams.get("status") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 100) || 100,
  });

  return ok({ calls, count: calls.length });
}
