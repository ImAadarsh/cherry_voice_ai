import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getOrder, updateOrderStatus } from "@/lib/repositories/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const order = await getOrder(restaurantId, Number(params.id));
  if (!order) return fail("Order not found", 404);
  return ok(order);
}

const patchSchema = z.object({
  status: z.enum([
    "draft",
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "completed",
    "cancelled",
    "refunded",
  ]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid status", 422, { issues: parsed.error.issues });

  const updated = await updateOrderStatus(restaurantId, Number(params.id), parsed.data.status);
  if (!updated) return fail("Order not found", 404);
  return ok({ id: Number(params.id), status: parsed.data.status });
}
