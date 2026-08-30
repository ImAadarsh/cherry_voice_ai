import "server-only";
import { getOrder } from "@/lib/repositories/orders";
import { sendSms } from "@/lib/notifications";
import type { VoiceSessionRecord } from "./session-store";
export async function sendPostCallOrderSms(session: VoiceSessionRecord, on: boolean) {
  if (!on || !session.orderId) return;
  const phone = session.callerPhone ?? session.conversationMemory.phone;
  if (!phone) return;
  const order = await getOrder(session.restaurantId, session.orderId);
  if (!order) return;
  const o = order as { order_number?: unknown; id?: unknown };
  await sendSms(phone, `Thanks for your order #${o.order_number ?? o.id}! — Cherry Voice`, {
    restaurantId: session.restaurantId, orderId: session.orderId,
  });
}
