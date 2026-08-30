import "server-only";
import type { PaymentProvider } from "@/types";
import type { PaymentGateway } from "./types";
import { StripeGateway, type StripeGatewayConfig } from "./stripe";
import { RazorpayGateway, type RazorpayGatewayConfig } from "./razorpay";
import { loadRestaurantGatewayConfig } from "./credentials";

export * from "./types";
export * from "./credentials";

type GatewayConfig = StripeGatewayConfig | RazorpayGatewayConfig;

/**
 * Gateway factory. Returns a lazily-instantiated adapter for the requested
 * provider using platform env credentials. Add new gateways (PayPal, Square...)
 * by implementing PaymentGateway and registering them here.
 */
const envCache = new Map<PaymentProvider, PaymentGateway>();

export function getGateway(provider: PaymentProvider, config?: GatewayConfig): PaymentGateway {
  if (config) {
    switch (provider) {
      case "stripe":
        return new StripeGateway(config as StripeGatewayConfig);
      case "razorpay":
        return new RazorpayGateway(config as RazorpayGatewayConfig);
      default:
        throw new Error(`Payment provider not supported: ${provider}`);
    }
  }

  const existing = envCache.get(provider);
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
  envCache.set(provider, gateway);
  return gateway;
}

/** Load restaurant-scoped credentials (DB with env fallback) and return a gateway. */
export async function getGatewayForRestaurant(
  restaurantId: number,
  provider: PaymentProvider,
): Promise<PaymentGateway> {
  const config = await loadRestaurantGatewayConfig(restaurantId, provider);
  return getGateway(provider, config);
}

export const SUPPORTED_PROVIDERS: PaymentProvider[] = ["stripe", "razorpay"];
