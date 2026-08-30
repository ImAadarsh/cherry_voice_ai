import "server-only";
import { env } from "../env";
import { listPaymentGateways } from "../repositories/settings";
import type { PaymentProvider } from "@/types";
import type { RazorpayGatewayConfig } from "./razorpay";
import type { StripeGatewayConfig } from "./stripe";

function parseCredentials(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, string>;
}

export type RestaurantGatewayConfig = StripeGatewayConfig | RazorpayGatewayConfig;

/** Load gateway credentials for a restaurant, falling back to platform env vars. */
export async function loadRestaurantGatewayConfig(
  restaurantId: number,
  provider: PaymentProvider,
): Promise<RestaurantGatewayConfig> {
  const gateways = await listPaymentGateways(restaurantId);
  const gw = gateways.find((g) => g.provider === provider);
  const creds = parseCredentials(gw?.credentials);

  if (provider === "stripe") {
    const secretKey = creds.secretKey || env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      if (gw) {
        throw new Error(
          "Stripe secret key is not configured for this restaurant. Add it in Settings → Payment Gateways.",
        );
      }
      throw new Error(
        "STRIPE_SECRET_KEY is not configured. Add platform keys or configure Stripe in Settings → Payment Gateways.",
      );
    }
    return {
      secretKey,
      webhookSecret: creds.webhookSecret || env.STRIPE_WEBHOOK_SECRET,
    };
  }

  if (provider === "razorpay") {
    const keyId = gw?.public_key || env.RAZORPAY_KEY_ID;
    const keySecret = creds.keySecret || env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      if (gw) {
        throw new Error(
          "Razorpay keys are not configured for this restaurant. Add Key ID and Key Secret in Settings → Payment Gateways.",
        );
      }
      throw new Error(
        "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured. Add platform keys or configure Razorpay in Settings → Payment Gateways.",
      );
    }
    return {
      keyId,
      keySecret,
      webhookSecret: creds.webhookSecret || env.RAZORPAY_WEBHOOK_SECRET,
    };
  }

  throw new Error(`Payment provider not supported: ${provider}`);
}
