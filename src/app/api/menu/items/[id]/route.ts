import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { deleteMenuItem, getMenuItem, updateMenuItem } from "@/lib/repositories/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/menu/items/[id] — single menu item. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid item id", 400);
  const item = await getMenuItem(restaurantId, id);
  if (!item) return fail("Menu item not found", 404);
  return ok(item);
}

const patchSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  sku: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  imageUrl: z.string().url().nullable().optional(),
  isAvailable: z.boolean().optional(),
  isVegetarian: z.boolean().optional(),
  spiceLevel: z.number().int().min(0).max(5).nullable().optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  options: z.unknown().optional(),
  allergens: z.unknown().optional(),
  sortOrder: z.number().int().optional(),
});

/** PATCH /api/menu/items/[id] — partial update. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid item id", 400);

  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid update payload", 422, { issues: parsed.error.issues });

  const existing = await getMenuItem(restaurantId, id);
  if (!existing) return fail("Menu item not found", 404);

  await updateMenuItem(restaurantId, id, parsed.data);
  const item = await getMenuItem(restaurantId, id);
  return ok(item);
}

/** DELETE /api/menu/items/[id] — remove a menu item. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid item id", 400);

  const deleted = await deleteMenuItem(restaurantId, id);
  if (!deleted) return fail("Menu item not found", 404);
  return ok({ id, deleted: true });
}
