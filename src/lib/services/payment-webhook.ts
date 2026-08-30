import "server-only";
import { getGateway, getGatewayForRestaurant } from "../payments";
import { extractRazorpayOrderIdFromWebhook } from "../payments/razorpay";
import { recordWebhook, markWebhook } from "../repositories/webhooks";
import { confirmOrderPayment } from "./confirm-order-payment";
import { queryOne } from "../db";
import type { PaymentProvider, WebhookSource } from "@/types";

/**
 * Shared handler for gateway webhooks. Verifies signature (inside the adapter),
 * logs the event idempotently, reconciles the payment row, and syncs the order.
 */
export async function handlePaymentWebhook(provider: PaymentProvider, req: Request) {
  const rawBody = await req.text();
  let gateway = getGateway(provider);

  if (provider === "razorpay") {
    const orderId = extractRazorpayOrderIdFromWebhook(rawBody);
    if (orderId) {
      const order = await queryOne<{ restaurant_id: number }>(
        "SELECT restaurant_id FROM orders WHERE id = ? LIMIT 1",
        [orderId],
      );
      if (order) {
        gateway = await getGatewayForRestaurant(order.restaurant_id, provider);
      }
    }
  }

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
    let paymentId: number | null = null;
    let orderId = event.orderId ?? null;

    if (orderId) {
      const result = await confirmOrderPayment({
        provider,
        status: event.status,
        providerPaymentId: event.providerPaymentId,
        providerIntentId: event.providerIntentId,
        orderId,
        amount: event.amount,
        method: event.method,
        raw: event.raw,
      });
      paymentId = result.paymentId;
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
