import type { PaymentProvider } from "@/types";

/** Input to create a hosted payment link for an order. */
export interface CreatePaymentLinkInput {
  orderId: number;
  amount: number; // minor units
  currency: string;
  description?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  /** Where the gateway should redirect the customer after payment. */
  callbackUrl?: string;
  /** Arbitrary metadata attached to the gateway object for reconciliation. */
  metadata?: Record<string, string | number>;
}

/** Normalised result returned by every gateway adapter. */
export interface PaymentLinkResult {
  provider: PaymentProvider;
  /** Provider link/object id (pl_..., plink_...). */
  providerLinkId: string;
  /** Underlying payment/intent/order id when applicable. */
  providerIntentId?: string;
  /** The URL to send to the customer. */
  url: string;
  amount: number;
  currency: string;
  raw?: unknown;
}

/** Normalised webhook event after signature verification + parsing. */
export interface NormalizedPaymentEvent {
  provider: PaymentProvider;
  /** Provider event id, used for idempotency. */
  eventId: string;
  eventType: string;
  status: "paid" | "failed" | "refunded" | "pending" | "cancelled" | "expired" | "unknown";
  providerPaymentId?: string;
  providerIntentId?: string;
  /** Our order id, resolved from gateway metadata when present. */
  orderId?: number;
  amount?: number;
  currency?: string;
  method?: string;
  raw: unknown;
}

/** Contract every payment gateway adapter must implement. */
export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult>;
  /**
   * Verify signature and parse a raw webhook request into a normalized event.
   * @param rawBody the exact raw request body (required for signature checks)
   * @param headers request headers
   */
  parseWebhook(rawBody: string, headers: Headers): Promise<NormalizedPaymentEvent>;
}
