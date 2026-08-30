import { ok, fail } from "@/lib/http";
import { getPublicReservationByToken } from "@/lib/repositories/customer-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending approval",
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

/** GET /api/public/reservations/[token] — public reservation status (no auth). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) return fail("Invalid token", 400);

  const reservation = await getPublicReservationByToken(token);
  if (!reservation) return fail("Reservation not found", 404);

  return ok({
    customerName: reservation.customer_name,
    customerPhone: reservation.customer_phone,
    partySize: reservation.party_size,
    reservedAt: reservation.reserved_at,
    status: reservation.status,
    statusLabel: STATUS_LABELS[reservation.status] ?? reservation.status,
    notes: reservation.notes,
    updatedAt: reservation.updated_at,
    restaurant: {
      name: reservation.restaurant_name,
      phone: reservation.restaurant_phone,
      address: reservation.restaurant_address,
      city: reservation.restaurant_city,
      country: reservation.restaurant_country,
    },
  });
}
