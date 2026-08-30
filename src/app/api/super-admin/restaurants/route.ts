import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { listAllRestaurants, getPlatformStats } from "@/lib/repositories/admin";
import { createRestaurant } from "@/lib/repositories/restaurants";
import { createUser } from "@/lib/repositories/users";
import { logPlatformAudit } from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  restaurantName: z.string().min(2),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  phone: z.string().optional(),
  currency: z.string().length(3).optional(),
  country: z.string().max(2).optional(),
  city: z.string().optional(),
});

/** GET /api/super-admin/restaurants — all tenants with stats. */
export async function GET(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const [restaurants, stats] = await Promise.all([listAllRestaurants(), getPlatformStats()]);
  return ok({ restaurants, stats });
}

/** POST /api/super-admin/restaurants — create restaurant + owner admin user. */
export async function POST(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid restaurant payload", 422);

  try {
    const restaurantId = await createRestaurant({
      name: parsed.data.restaurantName,
      email: parsed.data.ownerEmail,
      phone: parsed.data.phone ?? null,
      currency: parsed.data.currency,
      country: parsed.data.country ?? null,
      city: parsed.data.city ?? null,
    });
    const userId = await createUser({
      restaurantId,
      name: parsed.data.ownerName,
      email: parsed.data.ownerEmail,
      password: parsed.data.ownerPassword,
      phone: parsed.data.phone ?? null,
      role: "owner",
    });

    await logPlatformAudit({
      actorUserId: session.userId,
      action: "restaurant.create",
      targetType: "restaurant",
      targetId: String(restaurantId),
      metadata: { ownerEmail: parsed.data.ownerEmail },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok({ restaurantId, userId }, { status: 201 });
  } catch (err) {
    return fail(`Failed to create restaurant: ${(err as Error).message}`, 400);
  }
}
