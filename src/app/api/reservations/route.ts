import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import {
  createReservation,
  getReservation,
  listReservations,
} from "@/lib/repositories/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Number(searchParams.get("limit") ?? 100) || 100);
  const data = await listReservations(restaurantId, limit);
  return ok({ data, count: data.length });
}

const createSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(3),
  partySize: z.number().int().positive().default(2),
  reservedAt: z.string().min(1),
  status: z
    .enum(["pending", "confirmed", "seated", "completed", "cancelled", "no_show"])
    .optional(),
  notes: z.string().nullable().optional(),
  customerId: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422, { issues: parsed.error.issues });

  const id = await createReservation(restaurantId, {
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    partySize: parsed.data.partySize,
    reservedAt: parsed.data.reservedAt,
    status: parsed.data.status,
    notes: parsed.data.notes,
    customerId: parsed.data.customerId,
  });
  const row = await getReservation(restaurantId, id);
  return ok(row, { status: 201 });
}
