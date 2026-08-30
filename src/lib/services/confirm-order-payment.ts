import "server-only";
import { queryOne } from "../db";
import { reconcilePayment } from "../repositories/payments";
import { setOrderPaymentStatus } from "../repositories/orders";
import { awardLoyaltyPoints } from "../repositories/customers";
import { getSetting } from "../repositories/settings";
import type { PaymentProvider } from "@/types";

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

export interface ConfirmOrderPaymentInput {
  provider: PaymentProvider;
  status: string;
  providerPaymentId?: string;
  providerIntentId?: string;
  orderId: number;
  amount?: number;
  method?: string;
  raw?: unknown;
}

/** Reconcile payment row and sync order status after a verified gateway event. Idempotent. */
export async function confirmOrderPayment(input: ConfirmOrderPaymentInput) {
  const existing = await queryOne<{ payment_status: string }>(
    "SELECT payment_status FROM orders WHERE id = ? LIMIT 1",
    [input.orderId],
  );
  if (!existing) throw new Error("Order not found");

  const alreadyPaid = ["paid", "refunded", "partially_refunded"].includes(existing.payment_status);
  if (alreadyPaid && input.status === "paid") {
    return { alreadyPaid: true as const, orderId: input.orderId, paymentId: null };
  }

  const { paymentId } = await reconcilePayment({
    provider: input.provider,
    status: input.status,
    providerPaymentId: input.providerPaymentId,
    providerIntentId: input.providerIntentId,
    orderId: input.orderId,
    amount: input.amount,
    method: input.method,
    raw: input.raw,
  });

  const orderStatus = toOrderPaymentStatus(input.status);
  if (orderStatus) {
    await setOrderPaymentStatus(input.orderId, orderStatus);
    if (input.status === "paid") {
      await poolSetOrderStatusConfirmed(input.orderId);
      await maybeAwardLoyalty(input.orderId);
    }
  }

  return { alreadyPaid: false as const, orderId: input.orderId, paymentId };
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
