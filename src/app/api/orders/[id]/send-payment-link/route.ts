import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { sendPaymentLinkForOrder } from "@/lib/services/payment-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["stripe", "razorpay"]).optional(),
  channels: z.array(z.enum(["sms", "email", "whatsapp"])).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

/**
 * POST /api/orders/[id]/send-payment-link
 * Generate a payment link for the order and deliver it to the customer over
 * SMS/email (stubbed). Returns the link and a per-channel delivery report.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const orderId = Number(params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) return fail("Invalid order id", 400);

  const body = await readJson(req);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid payload", 422, { issues: parsed.error.issues });

  try {
    const channels = parsed.data.channels?.filter(
      (c): c is "sms" | "email" => c === "sms" || c === "email",
    );
    const { link, sends } = await sendPaymentLinkForOrder(restaurantId, orderId, {
      provider: parsed.data.provider,
      channels,
      phoneOverride: parsed.data.phone,
      emailOverride: parsed.data.email,
    });

    return ok({
      order_id: orderId,
      payment: { url: link.url, provider: link.provider, providerLinkId: link.providerLinkId },
      sends,
    });
  } catch (err) {
    return fail((err as Error).message, 400);
  }
}
