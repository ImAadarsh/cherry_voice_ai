import "server-only";
import type { PaymentProvider } from "@/types";
import type { PaymentGateway } from "./types";
import { StripeGateway } from "./stripe";
import { RazorpayGateway } from "./razorpay";

export * from "./types";

/**
 * Gateway factory. Returns a lazily-instantiated adapter for the requested
 * provider. Add new gateways (PayPal, Square...) by implementing PaymentGateway
 * and registering them here.
 */
const cache = new Map<PaymentProvider, PaymentGateway>();

export function getGateway(provider: PaymentProvider): PaymentGateway {
  const existing = cache.get(provider);
  if (existing) return existing;

  let gateway: PaymentGateway;
  switch (provider) {
    case "stripe":
      gateway = new StripeGateway();
      break;
    case "razorpay":
      gateway = new RazorpayGateway();
      break;
    default:
      throw new Error(`Payment provider not supported: ${provider}`);
  }
  cache.set(provider, gateway);
  return gateway;
}

export const SUPPORTED_PROVIDERS: PaymentProvider[] = ["stripe", "razorpay"];
