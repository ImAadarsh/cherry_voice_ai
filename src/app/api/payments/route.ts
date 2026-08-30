import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { listPayments } from "@/lib/repositories/payments";
import type { PaymentProvider } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments
 * List payments for the tenant, filterable by status, provider, and order id.
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const provider = searchParams.get("provider");
  const orderId = searchParams.get("order_id");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50) || 50));

  const data = await listPayments(restaurantId, {
    status: status && status !== "all" ? status : undefined,
    provider: (provider as PaymentProvider) || undefined,
    orderId: orderId ? Number(orderId) : undefined,
    limit,
  });

  return ok({ data, count: data.length });
}
