import "server-only";
import { z } from "zod";
import { createOrder, getOrder } from "@/lib/repositories/orders";
import { listCategories, listMenuItems } from "@/lib/repositories/menu";
import { findCustomerByPhone } from "@/lib/repositories/customers-lookup";
import { createReservation } from "@/lib/repositories/reservations";
import { getRestaurant, getSettingsGrouped } from "@/lib/repositories/settings";
import { getAgentContext } from "@/lib/repositories/onboarding";
import { sendPaymentLinkForOrder } from "@/lib/services/payment-links";
import { resolveAgentMapping } from "@/lib/repositories/agents";
import { normalizePhoneInput } from "@/lib/phone-normalize";

function parseItems(raw: unknown): Array<{
  name: string;
  quantity: number;
  sku?: string | null;
  notes?: string | null;
  unit_price?: number | null;
}> {
  if (Array.isArray(raw)) return raw as never;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const createOrderSchema = z
  .object({
    phone: z.string().min(3).optional(),
    customer_phone: z.string().min(3).optional(),
    name: z.string().optional(),
    customer_name: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    order_type: z.enum(["pickup", "delivery", "dine_in"]).optional(),
    items: z.union([z.array(z.record(z.string(), z.unknown())), z.string()]).optional(),
    notes: z.string().optional(),
    agent_id: z.union([z.string(), z.number()]).optional(),
    speak_first: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const phone = data.phone ?? data.customer_phone;
    if (!phone?.trim()) {
      ctx.addIssue({ code: "custom", message: "phone is required", path: ["phone"] });
    }
    if (data.items == null) {
      ctx.addIssue({ code: "custom", message: "items is required", path: ["items"] });
    }
  });

export async function handleCreateOrder(restaurantId: number, body: unknown) {
  const parsed = createOrderSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return { status: 422 as const, body: { error: "Invalid order payload", issues: parsed.error.issues } };
  }

  const items = parseItems(parsed.data.items);
  if (items.length === 0) {
    return { status: 422 as const, body: { error: "At least one item is required" } };
  }

  const phone = normalizePhoneInput(parsed.data.phone ?? parsed.data.customer_phone ?? "");
  if (phone.replace(/\D/g, "").length < 7) {
    return { status: 422 as const, body: { error: "A valid customer phone number is required" } };
  }

  let agentId: number | null = null;
  if (parsed.data.agent_id != null) {
    const mapping = await resolveAgentMapping(restaurantId, parsed.data.agent_id);
    agentId = mapping?.id ?? null;
  }

  const orderId = await createOrder({
    restaurantId,
    channel: "voice",
    orderType: parsed.data.order_type ?? "pickup",
    agentId,
    customer: {
      phone,
      name: parsed.data.name ?? parsed.data.customer_name ?? null,
      email: parsed.data.email ?? null,
      address: parsed.data.address ?? null,
    },
    items: items.map((it) => ({
      name: String(it.name ?? "Item"),
      quantity: Number(it.quantity ?? 1),
      sku: it.sku ?? null,
      notes: it.notes ?? null,
      unitPrice: it.unit_price ?? null,
    })),
    notes: parsed.data.notes ?? null,
  });

  const order = await getOrder(restaurantId, orderId);
  return {
    status: 201 as const,
    body: {
      order_id: orderId,
      order_number: (order as Record<string, unknown> | null)?.order_number ?? null,
      total_amount: (order as Record<string, unknown> | null)?.total_amount ?? null,
      currency: (order as Record<string, unknown> | null)?.currency ?? null,
      status: "pending",
    },
  };
}

export async function handleGetMenu(restaurantId: number) {
  const [categories, items] = await Promise.all([
    listCategories(restaurantId),
    listMenuItems(restaurantId, { available: true, limit: 500 }),
  ]);
  return {
    status: 200 as const,
    body: {
      categories,
      items: items.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          price: row.price,
          currency: row.currency,
          category_id: row.category_id,
          sku: row.sku,
          is_available: row.is_available,
        };
      }),
    },
  };
}

export async function handleLookupCustomer(restaurantId: number, phone: string | null) {
  if (!phone?.trim()) {
    return { status: 422 as const, body: { error: "phone query parameter is required" } };
  }
  const normalized = normalizePhoneInput(phone.trim());
  const customer = await findCustomerByPhone(restaurantId, normalized);
  if (!customer) {
    return { status: 404 as const, body: { error: "Customer not found", phone } };
  }
  return { status: 200 as const, body: { customer } };
}

const paymentLinkSchema = z.object({
  order_id: z.coerce.number().int().positive(),
  phone: z.string().optional(),
  email: z.string().optional(),
  channels: z.array(z.enum(["sms", "email", "whatsapp"])).optional(),
});

export async function handleSendPaymentLink(restaurantId: number, body: unknown) {
  const parsed = paymentLinkSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return { status: 422 as const, body: { error: "Invalid payload", issues: parsed.error.issues } };
  }

  try {
    const { link, sends } = await sendPaymentLinkForOrder(restaurantId, parsed.data.order_id, {
      phoneOverride: parsed.data.phone ? normalizePhoneInput(parsed.data.phone) : undefined,
      emailOverride: parsed.data.email,
      channels: parsed.data.channels,
    });
    return {
      status: 200 as const,
      body: {
        payment_link: link.url,
        provider: link.provider,
        sends,
      },
    };
  } catch (err) {
    return { status: 502 as const, body: { error: (err as Error).message } };
  }
}

const reservationSchema = z.object({
  customer_name: z.string().min(1),
  customer_phone: z.string().min(3),
  party_size: z.coerce.number().int().positive().default(2),
  reserved_at: z.string().min(1),
  notes: z.string().optional(),
});

export async function handleCreateReservation(restaurantId: number, body: unknown) {
  const parsed = reservationSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return { status: 422 as const, body: { error: "Invalid reservation payload", issues: parsed.error.issues } };
  }

  const id = await createReservation(restaurantId, {
    customerName: parsed.data.customer_name,
    customerPhone: normalizePhoneInput(parsed.data.customer_phone),
    partySize: parsed.data.party_size,
    reservedAt: parsed.data.reserved_at,
    notes: parsed.data.notes ?? null,
    status: "confirmed",
  });

  return {
    status: 201 as const,
    body: {
      reservation_id: id,
      status: "confirmed",
      customer_name: parsed.data.customer_name,
      party_size: parsed.data.party_size,
      reserved_at: parsed.data.reserved_at,
    },
  };
}

export async function handleGetRestaurantInfo(restaurantId: number) {
  const [restaurant, ctx, settings] = await Promise.all([
    getRestaurant(restaurantId),
    getAgentContext(restaurantId),
    getSettingsGrouped(restaurantId),
  ]);

  const restaurantSettings = (settings.restaurant ?? {}) as Record<string, unknown>;
  const deliverySettings = (settings.delivery ?? {}) as Record<string, unknown>;

  return {
    status: 200 as const,
    body: {
      name: restaurant?.name ?? null,
      phone: restaurant?.phone ?? null,
      email: restaurant?.email ?? null,
      address: {
        line1: restaurant?.address_line1 ?? null,
        city: restaurant?.city ?? null,
        state: restaurant?.state ?? null,
        postal_code: restaurant?.postal_code ?? null,
        country: restaurant?.country ?? null,
      },
      currency: restaurant?.currency ?? "USD",
      timezone: restaurant?.timezone ?? "UTC",
      hours: ctx?.hours ?? (restaurantSettings.hours as string | undefined) ?? null,
      delivery_area: ctx?.delivery_zones ?? (deliverySettings.area as string | undefined) ?? null,
      policies: ctx?.policies ?? (restaurantSettings.policies as string | undefined) ?? null,
      cuisine_type: ctx?.cuisine_type ?? (restaurantSettings.cuisine_type as string | undefined) ?? null,
    },
  };
}
