export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed";

export type Channel = "voice" | "web" | "walk-in";

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  notes?: string;
}

export interface Order {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: Channel;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  eta?: string;
  agentId?: string;
  callId?: string;
  recordingUrl?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatarColor: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
  tags: string[];
  favorite?: string;
  preferences?: string;
  allergies?: string[];
  loyaltyPoints?: number;
  notes?: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
  popular?: boolean;
  emoji: string;
  prepTime: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

export type AgentStatus = "online" | "idle" | "offline";

export type PersonalityPreset = "warm" | "professional" | "casual";

export type VoiceAgentType = "native" | "platform";

export interface VoiceAgent {
  /** Local omnidim_agents.id */
  id: string;
  /** Platform agent id (used for API calls) or native id (cv_native_*) */
  omnidimAgentId: string;
  agentType: VoiceAgentType;
  name: string;
  role: string;
  status: AgentStatus;
  phoneNumber: string;
  language: string;
  voice: string;
  callsToday: number;
  avgDuration: number;
  successRate: number;
  model: string;
  isPrimary?: boolean;
  /** Native agent widget config (when agentType === 'native') */
  widgetEnabled?: boolean;
  greeting?: string;
  accentColor?: string;
  widgetPosition?: "bottom-right" | "bottom-left";
  personalityPreset?: PersonalityPreset;
}

export type CallOutcome =
  | "order_placed"
  | "inquiry"
  | "reservation"
  | "missed"
  | "transferred";

export interface CallLog {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  customerPhone: string;
  outcome: CallOutcome;
  duration: number;
  startedAt: string;
  orderId?: string;
  recordingUrl?: string;
  sentiment: "positive" | "neutral" | "negative";
  source?: "platform" | "cherry_voice";
  sessionId?: string;
}

export type PaymentMethod = "card" | "upi" | "wallet" | "cash" | "link";

export interface Payment {
  id: string;
  orderId: string;
  orderRef: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  gateway: "stripe" | "razorpay" | "cash";
  status: PaymentStatus;
  createdAt: string;
  linkStatus?: "sent" | "opened" | "paid" | "expired";
}

export interface KpiPoint {
  label: string;
  revenue: number;
  orders: number;
}

// ============================================================================
// Backend / domain types (used by API routes, repositories, and services).
// These mirror the enums in database/migrations/001_init_schema.sql.
// ============================================================================

/** Payment providers supported by the payment_gateways / payments enums. */
export type PaymentProvider = "stripe" | "razorpay" | "paypal" | "square" | "cash";

/** How an order entered the system (orders.channel). */
export type OrderChannel = "voice" | "web" | "pos" | "manual";

/** Fulfilment type (orders.order_type). */
export type OrderType = "delivery" | "pickup" | "dine_in";

/** Source of an inbound webhook (webhooks_log.source). */
export type WebhookSource = "omnidim" | "stripe" | "razorpay" | "paypal" | "square" | "internal";

/** A single line item as sent by the Omnidim order webhook. */
export interface OmnidimWebhookOrderItem {
  sku?: string | null;
  name: string;
  quantity: number;
  unit_price?: number | null; // minor units; resolved from menu if omitted
  notes?: string | null;
  options?: unknown;
}

/**
 * Defensive shape of the OmniDimension call/order webhook payload. The exact
 * fields vary by account configuration, so all members are optional. Adjust to
 * match your Omnidim post-call data mapping.
 */
export interface OmnidimOrderWebhook {
  event?: string;
  call_id?: string | number;
  restaurant_id?: number;
  agent_id?: string | number;
  customer?: {
    phone?: string;
    name?: string | null;
    email?: string | null;
    address?: string | null;
  };
  order?: {
    type?: OrderType;
    notes?: string | null;
    items?: OmnidimWebhookOrderItem[];
  };
}

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedAt: string;
  status: "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  notes?: string;
}
