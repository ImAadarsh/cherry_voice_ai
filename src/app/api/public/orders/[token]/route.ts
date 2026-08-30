import { ok, fail, readJson } from "@/lib/http";
import { z } from "zod";
import {
  getPublicOrderByToken,
  updatePublicOrderAddress,
} from "@/lib/repositories/customer-pages";
import { notifyStaffAddressUpdate } from "@/lib/services/staff-notifications";
import { formatMoney } from "@/lib/currency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapOrderStatus(status: string): string {
  if (status === "out_for_delivery" || status === "completed") return "delivered";
  if (status === "confirmed") return "confirmed";
  return status;
}

function mapPaymentStatus(status: string): string {
  if (status === "link_sent" || status === "processing") return "pending";
  if (status === "paid") return "paid";
  if (status === "partially_refunded") return "partially_refunded";
  return status;
}

/** GET /api/public/orders/[token] — public order tracking (no auth). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) return fail("Invalid token", 400);

  const data = await getPublicOrderByToken(token);
  if (!data) return fail("Order not found", 404);

  const { order, items, payment } = data;

  return ok({
    orderNumber: order.order_number,
    status: mapOrderStatus(order.status),
    rawStatus: order.status,
    paymentStatus: mapPaymentStatus(order.payment_status),
    orderType: order.order_type,
    currency: order.currency,
    subtotal: order.subtotal,
    taxAmount: order.tax_amount,
    deliveryFee: order.delivery_fee,
    discountAmount: order.discount_amount,
    tipAmount: order.tip_amount,
    totalAmount: order.total_amount,
    totalFormatted: formatMoney(order.total_amount, order.currency),
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    deliveryAddress: order.delivery_address,
    notes: order.notes,
    placedAt: order.placed_at ?? order.created_at,
    updatedAt: order.updated_at,
    restaurant: {
      name: order.restaurant_name,
      phone: order.restaurant_phone,
      address: order.restaurant_address,
    },
    items: items.map((it) => {
      const row = it as Record<string, unknown>;
      return {
        name: row.name,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        totalPrice: row.total_price,
        unitFormatted: formatMoney(Number(row.unit_price), order.currency),
        totalFormatted: formatMoney(Number(row.total_price), order.currency),
        notes: row.notes,
      };
    }),
    paymentLinkUrl: payment?.payment_link_url ?? null,
    canPay: !["paid", "refunded", "partially_refunded"].includes(order.payment_status),
    canDownloadInvoice: ["paid", "partially_refunded"].includes(order.payment_status),
  });
}

const addressSchema = z.object({
  delivery_address: z.string().trim().min(5).max(500),
});

/** PATCH /api/public/orders/[token] — customer updates delivery address. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) return fail("Invalid token", 400);

  const body = await readJson(req);
  const parsed = addressSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid address", 422, { issues: parsed.error.issues });

  const existing = await getPublicOrderByToken(token);
  if (!existing) return fail("Order not found", 404);

  const updated = await updatePublicOrderAddress(token, parsed.data.delivery_address);
  if (!updated) return fail("Address cannot be updated for this order", 409);

  void notifyStaffAddressUpdate(existing.order.restaurant_id, {
    id: existing.order.id,
    orderNumber: existing.order.order_number,
    customerName: existing.order.customer_name,
    address: parsed.data.delivery_address,
  }).catch(() => {});

  return ok({ deliveryAddress: parsed.data.delivery_address });
}
