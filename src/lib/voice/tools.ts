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
import { runToolWithTimeout } from "./circuit-breaker";
import {
  findAmbiguousMenuMatches,
  getMenuAliases,
  getHoursStatus,
  validateDeliveryZone,
} from "./restaurant-context";
import { getMenuCache, setMenuCache, type VoiceSessionRecord } from "./session-store";

export const CHERRY_VOICE_TOOL_DECLARATIONS = [
  {
    name: "get_menu",
    description: "Fetch the restaurant menu with categories and items. Use before quoting prices.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_restaurant_info",
    description: "Fetch hours, address, delivery area, and policies.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
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
      "Place an order after explicit customer confirmation (order_confirmed). Only once per call.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        phone: { type: SchemaType.STRING },
        name: { type: SchemaType.STRING },
        order_type: { type: SchemaType.STRING, description: "pickup, delivery, or dine_in" },
        order_confirmed: { type: SchemaType.BOOLEAN, description: "Customer said yes to readback" },
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
      required: ["phone", "items", "order_confirmed"],
    },
  },
  {
    name: "update_order",
    description: "Update an existing order from this call (order_id required).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_id: { type: SchemaType.NUMBER },
        phone: { type: SchemaType.STRING },
        name: { type: SchemaType.STRING },
        order_type: { type: SchemaType.STRING },
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

type JsonSchema = Record<string, unknown>;

/** Convert Gemini SchemaType declarations to OpenAI JSON Schema for Inworld Router. */
function geminiSchemaToJsonSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      out.type = value.toLowerCase();
    } else if (key === "properties" && value && typeof value === "object") {
      const props: Record<string, JsonSchema> = {};
      for (const [propKey, propVal] of Object.entries(value as Record<string, JsonSchema>)) {
        props[propKey] = geminiSchemaToJsonSchema(propVal);
      }
      out.properties = props;
    } else if (key === "items" && value && typeof value === "object") {
      out.items = geminiSchemaToJsonSchema(value as JsonSchema);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const CHERRY_VOICE_OPENAI_TOOLS = CHERRY_VOICE_TOOL_DECLARATIONS.map((decl) => ({
  type: "function" as const,
  function: {
    name: decl.name,
    description: decl.description,
    parameters: geminiSchemaToJsonSchema(decl.parameters as JsonSchema),
  },
}));

function applyMenuAliases(
  items: Array<Record<string, unknown>>,
  aliases: Record<string, string>,
): Array<Record<string, unknown>> {
  return items.map((item) => {
    const name = String(item.name ?? "").trim();
    const key = name.toLowerCase();
    const resolved = aliases[key];
    if (resolved) return { ...item, name: resolved, alias_from: name };
    return item;
  });
}

export async function executeCherryVoiceTool(
  restaurantId: number,
  name: string,
  args: Record<string, unknown>,
  session?: VoiceSessionRecord,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  return runToolWithTimeout(name, async () => {
    try {
      switch (name) {
        case "get_menu": {
          const cached = session ? getMenuCache(session) : null;
          if (cached) return { ok: true, data: cached };

          const result = await handleGetMenu(restaurantId);
          if (result.status >= 400) {
            return { ok: false, error: String((result.body as { error?: string }).error ?? "get_menu failed") };
          }

          const aliases = await getMenuAliases(restaurantId);
          const body = result.body as { items?: Array<Record<string, unknown>> };
          const items = body.items ?? [];
          const ambiguous: Record<string, string[]> = {};
          for (const item of items.slice(0, 100)) {
            const n = String(item.name ?? "");
            const matches = findAmbiguousMenuMatches(n, items);
            if (matches.length > 1) ambiguous[n] = matches;
          }

          const enriched = {
            ...body,
            menu_aliases: aliases,
            disambiguation_hints: ambiguous,
          };
          if (session) setMenuCache(session, enriched);
          return { ok: true, data: enriched };
        }
        case "get_restaurant_info": {
          const result = await handleGetRestaurantInfo(restaurantId);
          const hours = await getHoursStatus(restaurantId);
          if (session) session.hoursStatus = hours;
          return {
            ok: result.status < 400,
            data: { ...(result.body as object), hours_status: hours },
          };
        }
        case "lookup_customer": {
          const phone = typeof args.phone === "string" ? args.phone : session?.callerPhone ?? null;
          const result = await handleLookupCustomer(restaurantId, phone);
          return { ok: result.status < 400, data: result.body };
        }
        case "create_order": {
          if (!args.order_confirmed) {
            return {
              ok: false,
              error:
                "Read the full order back and get explicit yes before create_order. Pass order_confirmed: true only after confirmation.",
            };
          }
          if (session && !session.orderConfirmed) {
            session.orderConfirmed = true;
          }

          const hours = session?.hoursStatus ?? (await getHoursStatus(restaurantId));
          if (session) session.hoursStatus = hours;
          if (hours.hoursText && hours.isOpen === false) {
            return { ok: false, error: "Kitchen is closed — offer pickup when we reopen instead of placing the order." };
          }

          const orderType = String(args.order_type ?? "pickup").toLowerCase();
          const address = typeof args.address === "string" ? args.address : "";
          if (orderType === "delivery" && address) {
            const zone = await validateDeliveryZone(restaurantId, address);
            if (!zone.ok) return { ok: false, error: zone.message };
          }

          if (session?.orderId) {
            return {
              ok: false,
              error: `Order ${session.orderId} already exists. Use update_order with order_id ${session.orderId}.`,
            };
          }

          const aliases = await getMenuAliases(restaurantId);
          let items = Array.isArray(args.items) ? (args.items as Array<Record<string, unknown>>) : [];
          items = applyMenuAliases(items, aliases);

          const result = await handleCreateOrder(restaurantId, {
            ...args,
            items,
            agent_id: session?.agentId ?? undefined,
            call_log_id: session?.callLogId ?? undefined,
          });
          if (result.status < 400 && session) {
            const body = result.body as { order_id?: number };
            if (body.order_id) session.orderId = body.order_id;
          }
          return {
            ok: result.status < 400,
            data: result.body,
            error: result.status >= 400 ? String((result.body as { error?: string }).error ?? "create_order failed") : undefined,
          };
        }
        case "update_order": {
          const orderType = String(args.order_type ?? "").toLowerCase();
          const address = typeof args.address === "string" ? args.address : "";
          if (orderType === "delivery" && address) {
            const zone = await validateDeliveryZone(restaurantId, address);
            if (!zone.ok) return { ok: false, error: zone.message };
          }
          const aliases = await getMenuAliases(restaurantId);
          let items = Array.isArray(args.items) ? (args.items as Array<Record<string, unknown>>) : undefined;
          if (items) items = applyMenuAliases(items, aliases);

          const result = await handleUpdateOrder(
            restaurantId,
            items ? { ...args, items } : args,
            { sessionOrderId: session?.orderId ?? null },
          );
          return {
            ok: result.status < 400,
            data: result.body,
            error: result.status >= 400 ? String((result.body as { error?: string }).error ?? "update_order failed") : undefined,
          };
        }
        case "send_payment_link": {
          const result = await handleSendPaymentLink(restaurantId, args);
          const ok = result.status < 400;
          return {
            ok,
            data: ok
              ? {
                  ...(result.body as object),
                  spoken_confirmation: "I've sent a secure payment link to your phone.",
                }
              : result.body,
          };
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
  });
}
