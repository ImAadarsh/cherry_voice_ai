import "server-only";
import { getGateway } from "../payments";
import { recordWebhook, markWebhook } from "../repositories/webhooks";
import { reconcilePayment } from "../repositories/payments";
import { setOrderPaymentStatus } from "../repositories/orders";
import { awardLoyaltyPoints } from "../repositories/customers";
import { getSetting } from "../repositories/settings";
import { queryOne } from "../db";
import type { PaymentProvider, WebhookSource } from "@/types";

/** Map a normalized payment status to the order.payment_status enum. */
function toOrderPaymentStatus(status: string): string | null {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "pending":
      return "processing";
    default:
      return null;
  }
}

/**
 * Shared handler for gateway webhooks. Verifies signature (inside the adapter),
 * logs the event idempotently, reconciles the payment row, and syncs the order.
 */
export async function handlePaymentWebhook(provider: PaymentProvider, req: Request) {
  const rawBody = await req.text();
  const gateway = getGateway(provider);

  let event;
  try {
    event = await gateway.parseWebhook(rawBody, req.headers);
  } catch (err) {
    await recordWebhook({
      source: provider as WebhookSource,
      signatureValid: false,
      payload: safeJson(rawBody),
    });
    return { status: 400, body: { ok: false, error: (err as Error).message } };
  }

  const logged = await recordWebhook({
    source: provider as WebhookSource,
    eventType: event.eventType,
    externalEventId: event.eventId,
    signatureValid: true,
    payload: event.raw,
  });

  if (logged.duplicate) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  try {
    const { paymentId, orderId } = await reconcilePayment({
      provider,
      status: event.status,
      providerPaymentId: event.providerPaymentId,
      providerIntentId: event.providerIntentId,
      orderId: event.orderId,
      amount: event.amount,
      method: event.method,
      raw: event.raw,
    });

    const orderStatus = toOrderPaymentStatus(event.status);
    if (orderId && orderStatus) {
      await setOrderPaymentStatus(orderId, orderStatus);
      if (event.status === "paid") {
        await poolSetOrderStatusConfirmed(orderId);
        await maybeAwardLoyalty(orderId);
      }
    }

    await markWebhook(logged.id, "processed", {
      httpStatus: 200,
      relatedOrderId: orderId ?? undefined,
      relatedPaymentId: paymentId ?? undefined,
    });

    return { status: 200, body: { ok: true, orderId, paymentId, status: event.status } };
  } catch (err) {
    await markWebhook(logged.id, "failed", { errorMessage: (err as Error).message });
    return { status: 500, body: { ok: false, error: "processing_error" } };
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

async function poolSetOrderStatusConfirmed(orderId: number) {
  await queryOne(
    "UPDATE orders SET status = 'confirmed' WHERE id = ? AND status IN ('pending','draft')",
    [orderId],
  );
}

async function maybeAwardLoyalty(orderId: number) {
  const order = await queryOne<{
    id: number;
    restaurant_id: number;
    customer_id: number | null;
    total_amount: number;
    currency: string;
    metadata: string | null;
  }>("SELECT id, restaurant_id, customer_id, total_amount, currency, metadata FROM orders WHERE id = ?", [
    orderId,
  ]);
  if (!order?.customer_id) return;
  let meta: { loyalty_awarded?: boolean } = {};
  try {
    meta = order.metadata ? JSON.parse(order.metadata) : {};
  } catch {
    /* ignore */
  }
  if (meta.loyalty_awarded) return;

  const pointsPerDollar =
    Number(await getSetting<number>(order.restaurant_id, "loyalty", "points_per_dollar")) || 1;
  const points = Math.floor((order.total_amount / 100) * pointsPerDollar);
  await awardLoyaltyPoints(order.customer_id, orderId, points);
}
