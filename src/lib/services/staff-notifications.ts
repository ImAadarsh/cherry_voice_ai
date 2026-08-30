import "server-only";
import { getSetting } from "../repositories/settings";
import { sendEmail } from "../notifications";

/** Notify staff (webhook + email) when a new order is placed. Best-effort. */
export async function notifyStaffNewOrder(
  restaurantId: number,
  order: {
    id: number;
    orderNumber: string;
    customerName?: string | null;
    totalAmount: number;
    currency: string;
    channel: string;
  },
): Promise<void> {
  const enabled = await getSetting<boolean>(restaurantId, "notifications", "new_order_enabled");
  if (enabled === false) return;

  const webhookUrl = await getSetting<string>(restaurantId, "notifications", "new_order_webhook");
  const email = await getSetting<string>(restaurantId, "notifications", "new_order_email");

  const payload = {
    event: "order.created",
    restaurant_id: restaurantId,
    order_id: order.id,
    order_number: order.orderNumber,
    customer_name: order.customerName,
    total_amount: order.totalAmount,
    currency: order.currency,
    channel: order.channel,
  };

  if (webhookUrl && typeof webhookUrl === "string" && webhookUrl.startsWith("http")) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("[staff-notify] webhook failed:", (err as Error).message);
    }
  }

  if (email && typeof email === "string" && email.includes("@")) {
    const amount = (order.totalAmount / 100).toFixed(2);
    await sendEmail(
      email,
      `New order ${order.orderNumber}`,
      `New ${order.channel} order from ${order.customerName ?? "Guest"} — ${order.currency} ${amount}. Order #${order.orderNumber} (id ${order.id}).`,
      { restaurantId },
    );
  }
}
