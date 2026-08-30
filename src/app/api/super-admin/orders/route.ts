import { ok } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { listAllOrders } from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/super-admin/orders — cross-tenant orders with filters. */
export async function GET(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(req.url);
  const orders = await listAllOrders({
    restaurantId: searchParams.get("restaurant_id")
      ? Number(searchParams.get("restaurant_id"))
      : undefined,
    status: searchParams.get("status") ?? undefined,
    paymentStatus: searchParams.get("payment_status") ?? undefined,
    dateFrom: searchParams.get("date_from") ?? undefined,
    dateTo: searchParams.get("date_to") ?? undefined,
    search: searchParams.get("q") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 100) || 100,
  });

  return ok({ orders, count: orders.length });
}
