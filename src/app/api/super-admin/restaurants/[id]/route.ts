import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { createSession, sessionCookieOptions } from "@/lib/auth";
import {
  getRestaurantById,
  updateRestaurant,
  findRestaurantOwner,
  logPlatformAudit,
} from "@/lib/repositories/super-admin";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: z.enum(["active", "suspended", "trial", "closed"]).optional(),
  city: z.string().nullable().optional(),
  country: z.string().max(2).nullable().optional(),
  currency: z.string().length(3).optional(),
  impersonate: z.boolean().optional(),
});

/** GET /api/super-admin/restaurants/[id] — single tenant with stats. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return fail("Invalid restaurant id", 400);

  const restaurant = await getRestaurantById(id);
  if (!restaurant) return fail("Restaurant not found", 404);

  return ok({ restaurant });
}

/** PATCH /api/super-admin/restaurants/[id] — suspend, edit, or impersonate tenant owner. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return fail("Invalid restaurant id", 400);

  const existing = await getRestaurantById(id);
  if (!existing) return fail("Restaurant not found", 404);

  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid restaurant update payload", 422);

  const { impersonate, ...patch } = parsed.data;

  if (Object.keys(patch).length > 0) {
    await updateRestaurant(id, patch);
    await logPlatformAudit({
      actorUserId: session.userId,
      action: "restaurant.update",
      targetType: "restaurant",
      targetId: String(id),
      metadata: patch,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
  }

  if (impersonate) {
    const owner = await findRestaurantOwner(id);
    if (!owner) return fail("No active owner found for this restaurant", 404);

    const sessionId = await createSession({
      userId: owner.id,
      restaurantId: id,
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    cookies().set(sessionCookieOptions(sessionId));

    await logPlatformAudit({
      actorUserId: session.userId,
      action: "restaurant.impersonate",
      targetType: "restaurant",
      targetId: String(id),
      metadata: { ownerId: owner.id, ownerEmail: owner.email },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    const restaurant = await getRestaurantById(id);
    return ok({
      restaurant,
      impersonation: {
        sessionId,
        userId: owner.id,
        email: owner.email,
        redirectUrl: "/dashboard",
      },
    });
  }

  const restaurant = await getRestaurantById(id);
  return ok({ restaurant });
}
