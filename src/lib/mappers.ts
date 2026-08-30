import { toMajor } from "./money";
import type {
  CallLog,
  Customer,
  KpiPoint,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  Payment,
  VoiceAgent,
} from "@/types";

const AVATAR_COLORS = ["#DC2626", "#2563EB", "#16A34A", "#D97706", "#9333EA", "#0891B2"];

function colorForId(id: string | number): string {
  const n = Number(String(id).replace(/\D/g, "")) || 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function mapOrderStatus(status: string): Order["status"] {
  if (status === "ready") return "ready";
  if (status === "preparing" || status === "out_for_delivery") return "preparing";
  if (status === "confirmed") return "paid";
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "refunded") return "cancelled";
  if (status === "draft") return "pending";
  return status as Order["status"];
}

function mapPaymentStatus(status: string): Order["paymentStatus"] {
  if (status === "link_sent" || status === "processing") return "pending";
  if (status === "partially_refunded") return "refunded";
  return status as Order["paymentStatus"];
}

function mapChannel(channel: string): Order["channel"] {
  if (channel === "pos") return "walk-in";
  if (channel === "manual") return "web";
  return channel as Order["channel"];
}

export function mapOrderRow(
  row: Record<string, unknown>,
  items: Array<Record<string, unknown>> = [],
  currency = "USD",
): Order {
  const mappedItems: OrderItem[] = items.map((it) => ({
    id: String(it.id),
    name: String(it.name),
    qty: Number(it.quantity ?? 1),
    price: toMajor(Number(it.unit_price ?? 0), String(row.currency ?? currency)),
    notes: it.notes ? String(it.notes) : undefined,
  }));

  return {
    id: String(row.id),
    reference: String(row.order_number),
    customerId: row.customer_id ? String(row.customer_id) : "",
    customerName: String(row.customer_name ?? "Guest"),
    customerPhone: String(row.customer_phone ?? ""),
    status: mapOrderStatus(String(row.status)),
    paymentStatus: mapPaymentStatus(String(row.payment_status)),
    channel: mapChannel(String(row.channel)),
    items: mappedItems,
    subtotal: toMajor(Number(row.subtotal ?? 0), String(row.currency ?? currency)),
    tax: toMajor(Number(row.tax_amount ?? 0), String(row.currency ?? currency)),
    total: toMajor(Number(row.total_amount ?? 0), String(row.currency ?? currency)),
    createdAt: String(row.created_at ?? row.placed_at ?? new Date().toISOString()),
    agentId: row.agent_id ? String(row.agent_id) : undefined,
    callId: row.call_log_id ? String(row.call_log_id) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

export function mapCustomerRow(row: Record<string, unknown>, currency = "USD"): Customer {
  const tags = Array.isArray(row.tags)
    ? (row.tags as string[])
    : row.tags
      ? (JSON.parse(String(row.tags)) as string[])
      : [];

  let allergies: string[] = [];
  if (row.allergies) {
    try {
      allergies = Array.isArray(row.allergies)
        ? (row.allergies as string[])
        : (JSON.parse(String(row.allergies)) as string[]);
    } catch {
      allergies = [];
    }
  }

  return {
    id: String(row.id),
    name: String(row.name ?? "Guest"),
    phone: String(row.phone),
    email: row.email ? String(row.email) : undefined,
    avatarColor: colorForId(row.id as string | number),
    totalOrders: Number(row.total_orders ?? 0),
    totalSpent: toMajor(Number(row.total_spent ?? 0), currency),
    lastOrderAt: String(row.last_order_at ?? row.created_at ?? new Date().toISOString()),
    tags,
    preferences: row.preferences ? String(row.preferences) : row.notes ? String(row.notes) : undefined,
    allergies: allergies.length ? allergies : undefined,
    loyaltyPoints: Number(row.loyalty_points ?? 0),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
  };
}

export function mapMenuItemRow(row: Record<string, unknown>, currency = "USD"): MenuItem {
  return {
    id: String(row.id),
    categoryId: row.category_id ? String(row.category_id) : "",
    name: String(row.name),
    description: String(row.description ?? ""),
    price: toMajor(Number(row.price ?? 0), String(row.currency ?? currency)),
    available: Boolean(row.is_available ?? true),
    emoji: "🍽️",
    prepTime: Number(row.prep_time_minutes ?? 10),
  };
}

export function mapMenuCategoryRow(row: Record<string, unknown>): MenuCategory {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    emoji: "📋",
  };
}

export function mapAgentRow(row: Record<string, unknown>): VoiceAgent {
  const active = Boolean(row.is_active ?? true);
  const omnidimAgentId = String(row.omnidim_agent_id ?? row.id);
  return {
    id: String(row.id),
    omnidimAgentId,
    name: String(row.name),
    role: "Voice Agent",
    status: active ? "online" : "offline",
    phoneNumber: String(row.phone_number ?? "—"),
    language: String(row.language ?? "English"),
    voice: String(row.voice_id ?? "Default"),
    callsToday: 0,
    avgDuration: 0,
    successRate: active ? 0.9 : 0,
    model: "cherry-voice",
  };
}

export function mapCallRow(row: Record<string, unknown>, agentName = "Agent"): CallLog {
  const status = String(row.status ?? "completed");
  let outcome: CallLog["outcome"] = "inquiry";
  if (status === "no_answer" || status === "busy") outcome = "missed";
  else if (status === "completed") outcome = "order_placed";

  return {
    id: String(row.omnidim_call_id ?? row.id),
    agentId: row.agent_id ? String(row.agent_id) : "",
    agentName,
    customerName: String(row.from_number ?? row.to_number ?? "Unknown"),
    customerPhone: String(row.from_number ?? row.to_number ?? ""),
    outcome,
    duration: Number(row.duration_seconds ?? 0),
    startedAt: String(row.started_at ?? row.created_at ?? new Date().toISOString()),
    recordingUrl: row.recording_url ? String(row.recording_url) : undefined,
    sentiment: "neutral",
  };
}

export function mapPaymentRow(
  row: Record<string, unknown>,
  orderRef = "",
  customerName = "",
  currency = "USD",
): Payment {
  const status = mapPaymentStatus(String(row.status));
  let method: Payment["method"] = "link";
  if (row.method === "card") method = "card";
  else if (row.method === "upi") method = "upi";
  else if (row.method === "cash") method = "cash";

  return {
    id: String(row.id),
    orderId: String(row.order_id),
    orderRef,
    customerName,
    amount: toMajor(Number(row.amount ?? 0), String(row.currency ?? currency)),
    method,
    gateway: (row.provider as Payment["gateway"]) ?? "stripe",
    status,
    createdAt: String(row.created_at),
    linkStatus: row.status === "link_sent" ? "sent" : undefined,
  };
}

export function mapRevenueTrend(
  rows: Array<Record<string, unknown>>,
  currency = "USD",
): KpiPoint[] {
  return rows.map((r) => ({
    label: new Date(String(r.day)).toLocaleDateString("en-US", { weekday: "short" }),
    revenue: toMajor(Number(r.revenue ?? 0), currency),
    orders: Number(r.orders ?? 0),
  }));
}
