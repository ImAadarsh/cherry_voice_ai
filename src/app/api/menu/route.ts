import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { listCategories, listMenuItems, createMenuItem, getMenuItem } from "@/lib/repositories/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/menu
 * Returns the tenant's menu categories and items. Supports ?category_id, ?available, ?q filters.
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("category_id");
  const available = searchParams.get("available");

  const [categories, items] = await Promise.all([
    listCategories(restaurantId),
    listMenuItems(restaurantId, {
      categoryId: categoryId ? Number(categoryId) : undefined,
      available: available == null ? undefined : available === "true" || available === "1",
      search: searchParams.get("q") ?? undefined,
    }),
  ]);

  return ok({ categories, items });
}

const createSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  sku: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(), // minor units
  currency: z.string().length(3).optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional(),
  isVegetarian: z.boolean().optional(),
  spiceLevel: z.number().int().min(0).max(5).nullable().optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  options: z.unknown().optional(),
  allergens: z.unknown().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * POST /api/menu
 * Create a menu item for the tenant.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid menu item payload", 422, { issues: parsed.error.issues });

  try {
    const id = await createMenuItem(restaurantId, parsed.data);
    const item = await getMenuItem(restaurantId, id);
    return ok({ item }, { status: 201 });
  } catch (err) {
    return fail(`Failed to create menu item: ${(err as Error).message}`, 400);
  }
}
