import { ok } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { listAllUsers } from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/super-admin/users — all users across tenants. */
export async function GET(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(req.url);
  const users = await listAllUsers({
    restaurantId: searchParams.get("restaurant_id")
      ? Number(searchParams.get("restaurant_id"))
      : undefined,
    role: searchParams.get("role") ?? undefined,
    search: searchParams.get("q") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 100) || 100,
  });

  return ok({ users, count: users.length });
}
