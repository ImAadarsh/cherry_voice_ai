import "server-only";
import { queryOne } from "../db";
import { env } from "../env";
import { customerOrderPageUrl } from "../customer-page-token";
import { getGatewayForRestaurant } from "../payments";
import { ensureOrderCustomerToken } from "../repositories/customer-pages";
import { createPaymentRecord } from "../repositories/payments";
import { sendSms, sendEmail, sendWhatsApp, type NotificationResult } from "../notifications";
import { formatMoney } from "../money";
import type { PaymentProvider } from "@/types";
import type { RowDataPacket } from "mysql2";

interface OrderRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  total_amount: number;
  currency: string;
  customer_name: string | null;
  customer_phone: string | null;
}

/** Read the default gateway for a restaurant from settings, then payment_gateways. */
async function resolveProvider(restaurantId: number): Promise<PaymentProvider> {
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM settings WHERE restaurant_id = ? AND category = 'payment' AND `key` = 'default_provider' LIMIT 1",
    [restaurantId],
  );
  if (setting?.value) {
    try {
      const v = JSON.parse(setting.value) as PaymentProvider;
      if (v) return v;
    } catch {
      /* ignore */
    }
  }
  const gw = await queryOne<{ provider: PaymentProvider }>(
    "SELECT provider FROM payment_gateways WHERE restaurant_id = ? AND is_active = 1 ORDER BY is_default DESC, id ASC LIMIT 1",
    [restaurantId],
  );
  return gw?.provider ?? "stripe";
}

/**
 * Create a hosted payment link for an order using the restaurant's default (or
 * a specified) gateway, persist a `payments` row, and return the link.
 */
export async function createPaymentLinkForOrder(
  restaurantId: number,
  orderId: number,
  provider?: PaymentProvider,
) {
  const order = await queryOne<OrderRow>(
    "SELECT id, restaurant_id, total_amount, currency, customer_name, customer_phone FROM orders WHERE id = ? AND restaurant_id = ?",
    [orderId, restaurantId],
  );
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.total_amount <= 0) throw new Error("Order total must be greater than zero");

  const chosen = provider ?? (await resolveProvider(restaurantId));
  const gateway = await getGatewayForRestaurant(restaurantId, chosen);
  const pageToken = await ensureOrderCustomerToken(order.id);
  const customerPageUrl = customerOrderPageUrl(pageToken, env.APP_BASE_URL);

  const result = await gateway.createPaymentLink({
    orderId: order.id,
    amount: order.total_amount,
    currency: order.currency,
    description: `Order payment`,
    customer: {
      name: order.customer_name ?? undefined,
      phone: order.customer_phone ?? undefined,
    },
    callbackUrl: `${customerPageUrl}?paid=1`,
    metadata: { order_id: order.id, restaurant_id: restaurantId, customer_page_token: pageToken },
  });

  await createPaymentRecord({
    restaurantId,
    orderId: order.id,
    provider: result.provider,
    providerLinkId: result.providerLinkId,
    providerIntentId: result.providerIntentId,
    paymentLinkUrl: result.url,
    amount: result.amount,
    currency: result.currency,
  });

  // Reflect link-sent state on the order.
  await queryOne("UPDATE orders SET payment_status = 'link_sent' WHERE id = ?", [order.id]);

  return result;
}

interface OrderContactRow extends RowDataPacket {
  id: number;
  total_amount: number;
  currency: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
}

/**
 * Create a payment link for an order and deliver it to the customer over the
 * requested channels (SMS/email). Delivery uses stubs for now (see
 * `lib/notifications`). Returns the link plus a per-channel send report.
 */
export async function sendPaymentLinkForOrder(
  restaurantId: number,
  orderId: number,
  opts?: {
    provider?: PaymentProvider;
    channels?: Array<"sms" | "email" | "whatsapp">;
    phoneOverride?: string;
    emailOverride?: string;
  },
): Promise<{ link: Awaited<ReturnType<typeof createPaymentLinkForOrder>>; sends: NotificationResult[] }> {
  const link = await createPaymentLinkForOrder(restaurantId, orderId, opts?.provider);

  const order = await queryOne<OrderContactRow>(
    `SELECT o.id, o.total_amount, o.currency, o.customer_name, o.customer_phone, c.email AS customer_email
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ? AND o.restaurant_id = ?`,
    [orderId, restaurantId],
  );

  const phone = opts?.phoneOverride ?? order?.customer_phone ?? "";
  const email = opts?.emailOverride ?? order?.customer_email ?? "";
  const amount = order ? formatMoney(order.total_amount, order.currency) : "";
  const pageToken = await ensureOrderCustomerToken(orderId);
  const trackUrl = customerOrderPageUrl(pageToken, env.APP_BASE_URL);
  const message = `Your order from us is ready. Track & pay ${amount} here: ${trackUrl}`;

  const channels = opts?.channels ?? [
    ...(phone ? (["sms"] as const) : []),
    ...(email ? (["email"] as const) : []),
  ];

  const sends: NotificationResult[] = [];
  const logOpts = { restaurantId, orderId, customerId: undefined as number | undefined };
  for (const channel of channels) {
    if (channel === "sms") {
      sends.push(await sendSms(phone, message, logOpts));
    } else if (channel === "whatsapp") {
      sends.push(await sendWhatsApp(phone, message, logOpts));
    } else if (channel === "email") {
      sends.push(await sendEmail(email, "Complete your payment", message, logOpts));
    }
  }

  return { link, sends };
}
