import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getCustomer, getCustomerOrders, updateCustomer } from "@/lib/repositories/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/customers/[id]
 * Customer detail plus their recent orders.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid customer id", 400);

  const customer = await getCustomer(restaurantId, id);
  if (!customer) return fail("Customer not found", 404);

  const orders = await getCustomerOrders(restaurantId, id);
  return ok({ ...customer, orders });
}

const patchSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
  preferences: z.string().nullable().optional(),
  allergies: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * PATCH /api/customers/[id]
 * Update CRM fields: preferences, allergies, notes, tags.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid customer id", 400);

  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422, { issues: parsed.error.issues });

  const updated = await updateCustomer(restaurantId, id, parsed.data);
  if (!updated) return fail("Customer not found", 404);

  const customer = await getCustomer(restaurantId, id);
  return ok(customer);
}
