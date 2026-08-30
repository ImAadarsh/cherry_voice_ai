import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { createCategory, listCategories } from "@/lib/repositories/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/menu/categories — list menu categories. */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const data = await listCategories(restaurantId);
  return ok({ data, count: data.length });
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/** POST /api/menu/categories — create a category. */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid category payload", 422, { issues: parsed.error.issues });

  try {
    const id = await createCategory(restaurantId, parsed.data);
    return ok({ id, ...parsed.data }, { status: 201 });
  } catch (err) {
    return fail(`Failed to create category: ${(err as Error).message}`, 400);
  }
}
