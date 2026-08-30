import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { listPaymentGateways, upsertPaymentGateway } from "@/lib/repositories/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings/payment-gateways
 * List configured gateways for the restaurant. Only non-secret config is
 * stored/returned — secret keys live in environment variables.
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const data = await listPaymentGateways(restaurantId);
  return ok({ data, count: data.length });
}

const patchSchema = z.object({
  provider: z.enum(["stripe", "razorpay"]),
  displayName: z.string().nullable().optional(),
  mode: z.enum(["test", "live"]).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  publicKey: z.string().nullable().optional(),
  // Non-secret config only (account ids, webhook ids). Never post secret keys.
  credentials: z.record(z.string(), z.unknown()).optional(),
  secretKey: z.string().nullable().optional(),
  keySecret: z.string().nullable().optional(),
  supportedCurrencies: z.array(z.string()).optional(),
});

/**
 * PATCH /api/settings/payment-gateways
 * Create/update a gateway configuration. Marking one default unsets the others.
 */
export async function PATCH(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid gateway payload", 422, { issues: parsed.error.issues });

  try {
    const credentials = {
      ...(parsed.data.credentials ?? {}),
      ...(parsed.data.secretKey ? { secretKey: parsed.data.secretKey } : {}),
      ...(parsed.data.keySecret ? { keySecret: parsed.data.keySecret } : {}),
    };
    await upsertPaymentGateway(restaurantId, {
      ...parsed.data,
      credentials: Object.keys(credentials).length ? credentials : undefined,
    });
    const data = await listPaymentGateways(restaurantId);
    return ok({ data });
  } catch (err) {
    return fail(`Failed to update gateway: ${(err as Error).message}`, 400);
  }
}
