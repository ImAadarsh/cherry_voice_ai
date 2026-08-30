import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { deleteCategory, getCategory, updateCategory } from "@/lib/repositories/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/menu/categories/[id] — single menu category. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid category id", 400);

  const category = await getCategory(restaurantId, id);
  if (!category) return fail("Category not found", 404);
  return ok(category);
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/** PATCH /api/menu/categories/[id] — partial update. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid category id", 400);

  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid update payload", 422, { issues: parsed.error.issues });

  const existing = await getCategory(restaurantId, id);
  if (!existing) return fail("Category not found", 404);

  await updateCategory(restaurantId, id, parsed.data);
  const category = await getCategory(restaurantId, id);
  return ok(category);
}

/** DELETE /api/menu/categories/[id] — remove a menu category. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid category id", 400);

  const deleted = await deleteCategory(restaurantId, id);
  if (!deleted) return fail("Category not found", 404);
  return ok({ id, deleted: true });
}
