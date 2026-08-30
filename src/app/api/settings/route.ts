import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import {
  getRestaurant,
  getSettingsGrouped,
  listPaymentGateways,
  updateRestaurant,
  upsertSettings,
} from "@/lib/repositories/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings
 * Returns the restaurant profile, grouped key/value settings, and a summary of
 * configured payment gateways.
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const [restaurant, settings, gateways] = await Promise.all([
    getRestaurant(restaurantId),
    getSettingsGrouped(restaurantId),
    listPaymentGateways(restaurantId),
  ]);
  if (!restaurant) return fail("Restaurant not found", 404);
  return ok({ restaurant, settings, paymentGateways: gateways });
}

const patchSchema = z.object({
  restaurant: z
    .object({
      name: z.string().optional(),
      legalName: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
      timezone: z.string().optional(),
      currency: z.string().length(3).optional(),
      addressLine1: z.string().nullable().optional(),
      addressLine2: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      postalCode: z.string().nullable().optional(),
      country: z.string().length(2).nullable().optional(),
      logoUrl: z.string().url().nullable().optional(),
    })
    .optional(),
  // Flexible key/value config: { category: { key: value } }
  settings: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

/**
 * PATCH /api/settings
 * Update restaurant profile fields and/or key-value settings.
 */
export async function PATCH(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid settings payload", 422, { issues: parsed.error.issues });

  if (parsed.data.restaurant) {
    await updateRestaurant(restaurantId, parsed.data.restaurant);
  }
  if (parsed.data.settings) {
    await upsertSettings(restaurantId, parsed.data.settings);
  }

  const [restaurant, settings] = await Promise.all([
    getRestaurant(restaurantId),
    getSettingsGrouped(restaurantId),
  ]);
  return ok({ restaurant, settings });
}
