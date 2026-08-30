import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { createOrder, getOrder, getOrderItemsForOrders, listOrders } from "@/lib/repositories/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders
 * List orders, filterable by status, payment status, date range, and search.
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50) || 50));

  const data = await listOrders(restaurantId, {
    status: status && status !== "all" ? status : undefined,
    paymentStatus: searchParams.get("payment_status") ?? undefined,
    dateFrom: searchParams.get("date_from") ?? undefined,
    dateTo: searchParams.get("date_to") ?? undefined,
    search: searchParams.get("q") ?? undefined,
    limit,
  });

  const itemMap = await getOrderItemsForOrders(data.map((o) => Number(o.id)));
  const enriched = data.map((o) => ({
    ...o,
    items: itemMap.get(Number(o.id)) ?? [],
  }));

  return ok({ data: enriched, count: enriched.length });
}

const itemSchema = z.object({
  sku: z.string().optional(),
  menuItemId: z.number().int().positive().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().int().nonnegative().optional(), // minor units; resolved from menu if omitted
  notes: z.string().optional(),
  options: z.unknown().optional(),
});

const createSchema = z.object({
  channel: z.enum(["voice", "web", "pos", "manual"]).optional(),
  orderType: z.enum(["delivery", "pickup", "dine_in"]).optional(),
  callLogId: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional(),
  customer: z
    .object({
      phone: z.string().min(3),
      name: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
    })
    .optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
  taxRatePercent: z.number().nonnegative().optional(),
  deliveryFee: z.number().int().nonnegative().optional(),
  discountAmount: z.number().int().nonnegative().optional(),
  tipAmount: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

/**
 * POST /api/orders
 * Create an order (manual dashboard entry or programmatic). The Omnidim webhook
 * uses the same repository directly for voice-placed orders.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid order payload", 422, { issues: parsed.error.issues });

  try {
    const orderId = await createOrder({
      restaurantId,
      channel: parsed.data.channel ?? "manual",
      orderType: parsed.data.orderType,
      callLogId: parsed.data.callLogId ?? null,
      agentId: parsed.data.agentId ?? null,
      customer: parsed.data.customer,
      items: parsed.data.items,
      notes: parsed.data.notes ?? null,
      taxRatePercent: parsed.data.taxRatePercent,
      deliveryFee: parsed.data.deliveryFee,
      discountAmount: parsed.data.discountAmount,
      tipAmount: parsed.data.tipAmount,
      currency: parsed.data.currency,
    });

    const order = await getOrder(restaurantId, orderId);
    return ok(order, { status: 201 });
  } catch (err) {
    return fail(`Failed to create order: ${(err as Error).message}`, 400);
  }
}
