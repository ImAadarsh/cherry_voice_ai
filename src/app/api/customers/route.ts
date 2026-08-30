import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getCustomer, listCustomers, upsertCustomerByPhone } from "@/lib/repositories/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/customers
 * List customers for the tenant, optionally filtered by a search term (?q=).
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") ?? undefined;
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? 100) || 100));

  const data = await listCustomers(restaurantId, { search, limit });
  return ok({ data, count: data.length });
}

const createSchema = z.object({
  phone: z.string().min(3),
  name: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

/**
 * POST /api/customers
 * Create or update a customer by phone (unique per restaurant).
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid customer payload", 422, { issues: parsed.error.issues });

  try {
    const id = await upsertCustomerByPhone(restaurantId, {
      phone: parsed.data.phone,
      name: parsed.data.name ?? null,
      email: parsed.data.email ?? null,
      address: parsed.data.address ?? null,
    });
    const customer = await getCustomer(restaurantId, id);
    return ok(customer, { status: 201 });
  } catch (err) {
    return fail(`Failed to create customer: ${(err as Error).message}`, 400);
  }
}
