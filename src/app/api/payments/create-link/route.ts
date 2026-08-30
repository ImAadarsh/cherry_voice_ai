import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { createPaymentLinkForOrder } from "@/lib/services/payment-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  order_id: z.number().int().positive(),
  provider: z.enum(["stripe", "razorpay"]).optional(),
});

/**
 * Create a hosted payment link for an order. Called by the dashboard ("send
 * payment link") and reused by the Omnidim webhook flow.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422, { issues: parsed.error.issues });

  try {
    const link = await createPaymentLinkForOrder(
      restaurantId,
      parsed.data.order_id,
      parsed.data.provider,
    );
    return ok({ url: link.url, provider: link.provider, providerLinkId: link.providerLinkId });
  } catch (err) {
    return fail((err as Error).message, 400);
  }
}
