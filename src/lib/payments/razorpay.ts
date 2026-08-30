import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../env";
import type {
  CreatePaymentLinkInput,
  NormalizedPaymentEvent,
  PaymentGateway,
  PaymentLinkResult,
} from "./types";

/**
 * Razorpay adapter using the Payment Links API. Razorpay amounts are already in
 * the smallest currency unit (paise for INR), matching our internal convention.
 *
 * Requires RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET.
 */
export class RazorpayGateway implements PaymentGateway {
  readonly provider = "razorpay" as const;
  private client: Razorpay;

  constructor() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured");
    }
    this.client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    const link = await this.client.paymentLink.create({
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      description: input.description || `Order #${input.orderId}`,
      customer: {
        name: input.customer?.name,
        email: input.customer?.email,
        contact: input.customer?.phone,
      },
      notify: { sms: Boolean(input.customer?.phone), email: Boolean(input.customer?.email) },
      callback_url: input.callbackUrl,
      callback_method: input.callbackUrl ? "get" : undefined,
      notes: {
        order_id: String(input.orderId),
        ...(input.metadata ?? {}),
      },
    });

    return {
      provider: this.provider,
      providerLinkId: String(link.id),
      url: String(link.short_url),
      amount: input.amount,
      currency: input.currency,
      raw: link,
    };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<NormalizedPaymentEvent> {
    const signature = headers.get("x-razorpay-signature");
    if (!signature || !env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error("Missing Razorpay signature or webhook secret");
    }

    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (!safeEqual(expected, signature)) {
      throw new Error("Invalid Razorpay webhook signature");
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event;
    const paymentEntity = event.payload?.payment?.entity;
    const linkEntity = event.payload?.payment_link?.entity;
    const orderId = numeric(linkEntity?.notes?.order_id ?? paymentEntity?.notes?.order_id);

    const base = {
      provider: this.provider,
      // Razorpay does not send a stable event id header; hash the body.
      eventId: crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 40),
      eventType,
      orderId,
      raw: event,
    };

    switch (eventType) {
      case "payment_link.paid":
      case "payment.captured":
        return {
          ...base,
          status: "paid",
          providerPaymentId: paymentEntity?.id ?? linkEntity?.id,
          providerIntentId: linkEntity?.id,
          amount: paymentEntity?.amount ?? linkEntity?.amount_paid,
          currency: (paymentEntity?.currency ?? linkEntity?.currency)?.toUpperCase(),
          method: paymentEntity?.method,
        };
      case "payment.failed":
        return {
          ...base,
          status: "failed",
          providerPaymentId: paymentEntity?.id,
        };
      case "refund.processed":
        return {
          ...base,
          status: "refunded",
          providerPaymentId: paymentEntity?.id,
          amount: event.payload?.refund?.entity?.amount,
        };
      case "payment_link.expired":
        return { ...base, status: "expired", providerIntentId: linkEntity?.id };
      case "payment_link.cancelled":
        return { ...base, status: "cancelled", providerIntentId: linkEntity?.id };
      default:
        return { ...base, status: "unknown" };
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function numeric(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
