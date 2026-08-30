import { ok, fail } from "@/lib/http";
import { getOrCreatePaymentLinkForOrder } from "@/lib/services/payment-links";
import { getPublicOrderByToken } from "@/lib/repositories/customer-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/public/orders/[token]/pay — create or refresh payment link for customer page. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) return fail("Invalid token", 400);

  const data = await getPublicOrderByToken(token);
  if (!data) return fail("Order not found", 404);

  const { order } = data;
  if (["paid", "refunded", "partially_refunded"].includes(order.payment_status)) {
    return fail("Order is already paid", 409);
  }
  if (order.total_amount <= 0) return fail("Nothing to pay", 422);

  try {
    const link = await getOrCreatePaymentLinkForOrder(order.restaurant_id, order.id);
    return ok({ paymentLinkUrl: link.url, provider: link.provider, reused: link.reused });
  } catch (err) {
    return fail((err as Error).message, 502);
  }
}
