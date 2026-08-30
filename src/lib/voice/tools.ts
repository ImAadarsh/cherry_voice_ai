import "server-only";
import { SchemaType } from "@google/generative-ai";
import {
  handleCreateOrder,
  handleCreateReservation,
  handleGetMenu,
  handleGetRestaurantInfo,
  handleLookupCustomer,
  handleSendPaymentLink,
  handleUpdateOrder,
} from "@/lib/integrations/omnidim-handlers";
import type { VoiceSessionRecord } from "./session-store";

export const CHERRY_VOICE_TOOL_DECLARATIONS = [
  {
    name: "get_menu",
    description: "Fetch the restaurant menu with categories and items. Use before quoting prices.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_restaurant_info",
    description: "Fetch hours, address, delivery area, and policies.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "lookup_customer",
    description: "Look up a customer by phone number for personalization.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        phone: { type: SchemaType.STRING, description: "Customer phone number" },
      },
      required: ["phone"],
    },
  },
  {
    name: "create_order",
    description:
      "Place an order after collecting phone, name, order_type, and items. Only call once per call — if an order already exists, use update_order instead.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        phone: { type: SchemaType.STRING },
        name: { type: SchemaType.STRING },
        order_type: { type: SchemaType.STRING, description: "pickup, delivery, or dine_in" },
        items: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              quantity: { type: SchemaType.NUMBER },
              sku: { type: SchemaType.STRING },
              notes: { type: SchemaType.STRING },
            },
            required: ["name", "quantity"],
          },
        },
        notes: { type: SchemaType.STRING },
        address: { type: SchemaType.STRING },
      },
      required: ["phone", "items"],
    },
  },
  {
    name: "update_order",
    description:
      "Update an existing order from this call (name, phone, address, items, order_type, notes). Requires order_id from create_order.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_id: { type: SchemaType.NUMBER },
        phone: { type: SchemaType.STRING },
        name: { type: SchemaType.STRING },
        order_type: { type: SchemaType.STRING, description: "pickup, delivery, or dine_in" },
        items: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              quantity: { type: SchemaType.NUMBER },
              sku: { type: SchemaType.STRING },
              notes: { type: SchemaType.STRING },
            },
            required: ["name", "quantity"],
          },
        },
        notes: { type: SchemaType.STRING },
        address: { type: SchemaType.STRING },
      },
      required: ["order_id"],
    },
  },
  {
    name: "send_payment_link",
    description: "Send a secure payment link for an existing order.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_id: { type: SchemaType.NUMBER },
        phone: { type: SchemaType.STRING },
        email: { type: SchemaType.STRING },
      },
      required: ["order_id"],
    },
  },
  {
    name: "create_reservation",
    description: "Book a table reservation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        customer_name: { type: SchemaType.STRING },
        customer_phone: { type: SchemaType.STRING },
        party_size: { type: SchemaType.NUMBER },
        reserved_at: { type: SchemaType.STRING, description: "ISO datetime" },
        notes: { type: SchemaType.STRING },
      },
      required: ["customer_name", "customer_phone", "party_size", "reserved_at"],
    },
  },
] as const;

export async function executeCherryVoiceTool(
  restaurantId: number,
  name: string,
  args: Record<string, unknown>,
  session?: VoiceSessionRecord,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    switch (name) {
      case "get_menu": {
        const result = await handleGetMenu(restaurantId);
        return { ok: result.status < 400, data: result.body };
      }
      case "get_restaurant_info": {
        const result = await handleGetRestaurantInfo(restaurantId);
        return { ok: result.status < 400, data: result.body };
      }
      case "lookup_customer": {
        const phone = typeof args.phone === "string" ? args.phone : null;
        const result = await handleLookupCustomer(restaurantId, phone);
        return { ok: result.status < 400, data: result.body };
      }
      case "create_order": {
        if (session?.orderId) {
          return {
            ok: false,
            error: `Order ${session.orderId} already exists for this call. Use update_order with order_id ${session.orderId} to change details.`,
          };
        }
        const result = await handleCreateOrder(restaurantId, {
          ...args,
          agent_id: session?.agentId ?? undefined,
          call_log_id: session?.callLogId ?? undefined,
        });
        if (result.status < 400 && session) {
          const body = result.body as { order_id?: number };
          if (body.order_id) session.orderId = body.order_id;
        }
        return { ok: result.status < 400, data: result.body, error: result.status >= 400 ? String((result.body as { error?: string }).error ?? "create_order failed") : undefined };
      }
      case "update_order": {
        const result = await handleUpdateOrder(restaurantId, args, {
          sessionOrderId: session?.orderId ?? null,
        });
        return { ok: result.status < 400, data: result.body, error: result.status >= 400 ? String((result.body as { error?: string }).error ?? "update_order failed") : undefined };
      }
      case "send_payment_link": {
        const result = await handleSendPaymentLink(restaurantId, args);
        return { ok: result.status < 400, data: result.body };
      }
      case "create_reservation": {
        const result = await handleCreateReservation(restaurantId, args);
        return { ok: result.status < 400, data: result.body };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
