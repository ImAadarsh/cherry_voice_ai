import crypto from "node:crypto";
import { getOmnidimWebhookSecret } from "@/lib/platform-config";
import { ok, fail } from "@/lib/http";
import { recordWebhook, markWebhook } from "@/lib/repositories/webhooks";
import { findAgentByOmnidimId, findAgentByPhoneNumber } from "@/lib/repositories/agents";
import { upsertCallLog } from "@/lib/repositories/calls";
import { createOrder } from "@/lib/repositories/orders";
import { createPaymentLinkForOrder } from "@/lib/services/payment-links";
import type { OmnidimOrderWebhook } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OmniDimension webhook receiver.
 *
 * Configure Omnidim to POST call/order events here. We verify an optional HMAC
 * signature (OMNIDIM_WEBHOOK_SECRET) over the raw body, log every event for
 * idempotency, and — on an "order.placed" style event — create the order and
 * generate a payment link the agent can read/SMS to the customer.
 *
 * The exact Omnidim payload shape varies by account configuration, so parsing
 * is defensive. Adjust `OmnidimOrderWebhook` in src/types to match your setup.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  // Optional signature verification.
  let signatureValid: boolean | null = null;
  const webhookSecret = await getOmnidimWebhookSecret();
  if (webhookSecret) {
    const provided =
      req.headers.get("x-omnidim-signature") || req.headers.get("x-signature") || "";
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    signatureValid = timingSafe(expected, provided.replace(/^sha256=/, ""));
    if (!signatureValid) {
      await recordWebhook({ source: "omnidim", signatureValid, payload: safeJson(rawBody) });
      return fail("Invalid signature", 401);
    }
  }

  const payload = safeJson(rawBody) as OmnidimOrderWebhook | null;
  const eventType = payload?.event ?? "unknown";
  const externalEventId = String(payload?.call_id ?? "") || undefined;

  const logged = await recordWebhook({
    source: "omnidim",
    eventType,
    externalEventId,
    signatureValid,
    payload,
    headers: Object.fromEntries(req.headers),
  });

  if (logged.duplicate) {
    return ok({ received: true, duplicate: true });
  }

  try {
    // Resolve tenant from Omnidim agent id or dialed phone number — never guess a default tenant.
    let restaurantId: number | null = payload?.restaurant_id ?? null;
    let agentId: number | null = null;

    if (payload?.agent_id != null) {
      const agent = await findAgentByOmnidimId(String(payload.agent_id));
      if (agent) {
        restaurantId = agent.restaurant_id;
        agentId = agent.id;
      }
    }

    if (restaurantId == null) {
      const dialed =
        (payload as Record<string, unknown> | null)?.to_number ??
        (payload as Record<string, unknown> | null)?.phone_number;
      if (typeof dialed === "string") {
        const byPhone = await findAgentByPhoneNumber(dialed);
        if (byPhone) {
          restaurantId = byPhone.restaurant_id;
          agentId = byPhone.id;
        }
      }
    }

    if (restaurantId == null) {
      await markWebhook(logged.id, "ignored", {
        errorMessage: "Could not resolve restaurant from agent_id or phone number",
      });
      return ok({ received: true, ignored: true, reason: "tenant_unresolved" });
    }

    // Always record/refresh the call log.
    const callLogId = await upsertCallLog({
      restaurantId,
      agentId,
      omnidimCallId: externalEventId ?? null,
      direction: "inbound",
      fromNumber: payload?.customer?.phone ?? null,
      status: eventType.includes("completed") ? "completed" : "in_progress",
      raw: payload,
    });

    // Order events create an order + payment link.
    const isOrderEvent = /order/i.test(eventType) && Array.isArray(payload?.order?.items);
    if (!isOrderEvent) {
      await markWebhook(logged.id, "processed", { httpStatus: 200, relatedCallId: callLogId });
      return ok({ received: true, orderCreated: false });
    }

    const orderId = await createOrder({
      restaurantId,
      channel: "voice",
      orderType: payload?.order?.type ?? "pickup",
      callLogId,
      agentId,
      customer: payload?.customer?.phone
        ? {
            phone: payload.customer.phone,
            name: payload.customer.name ?? null,
            email: payload.customer.email ?? null,
            address: payload.customer.address ?? null,
          }
        : undefined,
      items: (payload!.order!.items ?? []).map((it) => ({
        sku: it.sku ?? null,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unit_price ?? null,
        notes: it.notes ?? null,
        options: it.options,
      })),
      notes: payload?.order?.notes ?? null,
    });

    // Generate a payment link (best-effort; failure shouldn't drop the order).
    let paymentLinkUrl: string | null = null;
    try {
      const link = await createPaymentLinkForOrder(restaurantId, orderId);
      paymentLinkUrl = link?.url ?? null;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("payment link creation failed:", (e as Error).message);
    }

    await markWebhook(logged.id, "processed", {
      httpStatus: 200,
      relatedOrderId: orderId,
      relatedCallId: callLogId,
    });

    return ok({ received: true, orderCreated: true, orderId, paymentLinkUrl });
  } catch (err) {
    await markWebhook(logged.id, "failed", { errorMessage: (err as Error).message });
    // eslint-disable-next-line no-console
    console.error("omnidim webhook error:", err);
    return fail("Processing error", 500);
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

function timingSafe(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}
