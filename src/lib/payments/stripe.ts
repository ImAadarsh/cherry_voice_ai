import "server-only";
import Stripe from "stripe";
import { env } from "../env";
import type {
  CreatePaymentLinkInput,
  NormalizedPaymentEvent,
  PaymentGateway,
  PaymentLinkResult,
} from "./types";

/**
 * Stripe adapter. Uses Payment Links (a hosted checkout URL) so the voice agent
 * flow can simply SMS/WhatsApp a URL to the customer.
 *
 * Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the environment.
 */
export class StripeGateway implements PaymentGateway {
  readonly provider = "stripe" as const;
  private client: Stripe;

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    this.client = new Stripe(env.STRIPE_SECRET_KEY);
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    // A price is created inline for the exact order total.
    const price = await this.client.prices.create({
      currency: input.currency.toLowerCase(),
      unit_amount: input.amount,
      product_data: { name: input.description || `Order #${input.orderId}` },
    });

    const link = await this.client.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        order_id: String(input.orderId),
        ...(input.metadata ?? {}),
      },
      after_completion: input.callbackUrl
        ? { type: "redirect", redirect: { url: input.callbackUrl } }
        : undefined,
    });

    return {
      provider: this.provider,
      providerLinkId: link.id,
      url: link.url,
      amount: input.amount,
      currency: input.currency,
      raw: link,
    };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<NormalizedPaymentEvent> {
    const sig = headers.get("stripe-signature");
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Missing Stripe signature or webhook secret");
    }

    // Throws if the signature does not verify.
    const event = this.client.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );

    const base = {
      provider: this.provider,
      eventId: event.id,
      eventType: event.type,
      raw: event,
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        return {
          ...base,
          status: s.payment_status === "paid" ? "paid" : "pending",
          providerPaymentId: (s.payment_intent as string) ?? s.id,
          providerIntentId: s.id,
          orderId: numeric(s.metadata?.order_id),
          amount: s.amount_total ?? undefined,
          currency: s.currency?.toUpperCase(),
        };
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        return {
          ...base,
          status: "paid",
          providerPaymentId: pi.id,
          orderId: numeric(pi.metadata?.order_id),
          amount: pi.amount_received,
          currency: pi.currency?.toUpperCase(),
        };
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        return {
          ...base,
          status: "failed",
          providerPaymentId: pi.id,
          orderId: numeric(pi.metadata?.order_id),
        };
      }
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        return {
          ...base,
          status: "refunded",
          providerPaymentId: (ch.payment_intent as string) ?? ch.id,
          amount: ch.amount_refunded,
          currency: ch.currency?.toUpperCase(),
        };
      }
      default:
        return { ...base, status: "unknown" };
    }
  }
}

function numeric(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
