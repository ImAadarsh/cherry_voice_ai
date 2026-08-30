import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { getPublicOrderByToken } from "@/lib/repositories/customer-pages";
import { loadRestaurantGatewayConfig } from "@/lib/payments/credentials";
import { verifyRazorpayPaymentLinkCallback } from "@/lib/payments/razorpay";
import { confirmOrderPayment } from "@/lib/services/confirm-order-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const razorpayCallbackSchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_payment_link_id: z.string().min(1),
  razorpay_payment_link_reference_id: z.string().optional(),
  razorpay_payment_link_status: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/** POST /api/public/orders/[token]/confirm-payment — verify Razorpay redirect and mark order paid. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) return fail("Invalid token", 400);

  const data = await getPublicOrderByToken(token);
  if (!data) return fail("Order not found", 404);

  const { order } = data;
  if (["paid", "refunded", "partially_refunded"].includes(order.payment_status)) {
    return ok({ alreadyPaid: true, paymentStatus: order.payment_status, orderStatus: order.status });
  }

  const body = await readJson(req);
  const parsed = razorpayCallbackSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Missing Razorpay payment parameters", 422);

  const params = parsed.data;
  if (!["paid", "partially_paid"].includes(params.razorpay_payment_link_status)) {
    return fail("Payment not completed", 402, { status: params.razorpay_payment_link_status });
  }

  const config = await loadRestaurantGatewayConfig(order.restaurant_id, "razorpay");
  if (!("keySecret" in config) || !config.keySecret) {
    return fail("Payment gateway not configured", 503);
  }

  const valid = verifyRazorpayPaymentLinkCallback(params, config.keySecret);
  if (!valid) return fail("Invalid payment signature", 403);

  try {
    const result = await confirmOrderPayment({
      provider: "razorpay",
      status: "paid",
      providerPaymentId: params.razorpay_payment_id,
      providerIntentId: params.razorpay_payment_link_id,
      orderId: order.id,
      amount: order.total_amount,
      raw: params,
    });

    const refreshed = await getPublicOrderByToken(token);
    return ok({
      alreadyPaid: result.alreadyPaid,
      paymentStatus: refreshed?.order.payment_status ?? "paid",
      orderStatus: refreshed?.order.status ?? "confirmed",
    });
  } catch (err) {
    return fail((err as Error).message, 500);
  }
}
