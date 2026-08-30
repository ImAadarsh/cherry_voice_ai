import { z } from "zod";
import Stripe from "stripe";
import Razorpay from "razorpay";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { env } from "@/lib/env";
import { listPaymentGateways } from "@/lib/repositories/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["stripe", "razorpay"]),
});

function parseCredentials(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, string>;
}

export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid test payload", 422, { issues: parsed.error.issues });

  const gateways = await listPaymentGateways(restaurantId);
  const gw = gateways.find((g) => g.provider === parsed.data.provider);
  const creds = parseCredentials(gw?.credentials);

  try {
    if (parsed.data.provider === "stripe") {
      const secret = creds.secretKey || env.STRIPE_SECRET_KEY;
      if (!secret) return fail("Stripe secret key not configured", 400);
      const stripe = new Stripe(secret);
      await stripe.balance.retrieve();
      return ok({ provider: "stripe", status: "connected" });
    }

    const keyId = gw?.public_key || env.RAZORPAY_KEY_ID;
    const keySecret = creds.keySecret || env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return fail("Razorpay keys not configured", 400);
    const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    await client.orders.all({ count: 1 });
    return ok({ provider: "razorpay", status: "connected" });
  } catch (err) {
    return fail(`Connection test failed: ${(err as Error).message}`, 400);
  }
}
