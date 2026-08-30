import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import {
  deleteReservation,
  getReservation,
  updateReservation,
} from "@/lib/repositories/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const row = await getReservation(restaurantId, Number(params.id));
  if (!row) return fail("Reservation not found", 404);
  return ok(row);
}

const patchSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  partySize: z.number().int().positive().optional(),
  reservedAt: z.string().optional(),
  status: z
    .enum(["pending", "confirmed", "seated", "completed", "cancelled", "no_show"])
    .optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const id = Number(params.id);
  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  const updated = await updateReservation(restaurantId, id, parsed.data);
  if (!updated) return fail("Reservation not found", 404);
  return ok(await getReservation(restaurantId, id));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const deleted = await deleteReservation(restaurantId, Number(params.id));
  if (!deleted) return fail("Reservation not found", 404);
  return ok({ deleted: true });
}
