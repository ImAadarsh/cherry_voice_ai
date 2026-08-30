import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { listCalls } from "@/lib/repositories/calls";
import { listOrders } from "@/lib/repositories/orders";
import { listPayments } from "@/lib/repositories/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/insights
 * Unified call → order → payment activity timeline.
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 40) || 40);

  const [calls, orders, payments] = await Promise.all([
    listCalls(restaurantId, limit),
    listOrders(restaurantId, { limit }),
    listPayments(restaurantId, { limit }),
  ]);

  const timeline = [
    ...calls.map((c) => ({
      type: "call" as const,
      id: `call-${c.id}`,
      entityId: c.id,
      at: c.created_at,
      title: `Inbound call ${c.from_number ?? c.to_number ?? ""}`.trim(),
      subtitle: c.summary ? String(c.summary).slice(0, 120) : undefined,
      status: c.status,
      meta: { duration: c.duration_seconds },
    })),
    ...orders.map((o) => ({
      type: "order" as const,
      id: `order-${o.id}`,
      entityId: o.id,
      at: o.created_at,
      title: `Order ${o.order_number}`,
      subtitle: `${o.customer_name ?? "Guest"} · ${o.channel}`,
      status: o.status,
      meta: {
        paymentStatus: o.payment_status,
        total: o.total_amount,
        currency: o.currency,
        callLogId: o.call_log_id,
      },
    })),
    ...payments.map((p) => ({
      type: "payment" as const,
      id: `payment-${p.id}`,
      entityId: p.id,
      at: p.created_at,
      title: `Payment ${p.status}`,
      subtitle: p.payment_link_url ? "Link sent" : `Order #${p.order_id}`,
      status: p.status,
      meta: {
        amount: p.amount,
        currency: p.currency,
        orderId: p.order_id,
        provider: p.provider,
      },
    })),
  ]
    .sort((a, b) => +new Date(String(b.at)) - +new Date(String(a.at)))
    .slice(0, limit);

  return ok({ timeline, calls, orders, payments });
}
