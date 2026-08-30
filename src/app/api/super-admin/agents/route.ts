import { ok } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { listAllAgents } from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/super-admin/agents — all voice agents across restaurants. */
export async function GET(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(req.url);
  const agents = await listAllAgents({
    restaurantId: searchParams.get("restaurant_id")
      ? Number(searchParams.get("restaurant_id"))
      : undefined,
    limit: Number(searchParams.get("limit") ?? 200) || 200,
  });

  return ok({ agents, count: agents.length });
}
