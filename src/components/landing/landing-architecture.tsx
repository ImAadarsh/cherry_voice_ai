"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ChevronRight,
  Database,
  Key,
  Layers,
  Server,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FlowId =
  | "order"
  | "reservation"
  | "payment"
  | "onboarding"
  | "tenant"
  | "services";

type NodeColor =
  | "gray"
  | "purple"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "pink";

const FLOW_TABS: Array<{ id: FlowId; label: string; short: string }> = [
  { id: "order", label: "Voice Order Flow", short: "Orders" },
  { id: "reservation", label: "Reservation Flow", short: "Reservations" },
  { id: "payment", label: "Payment Flow", short: "Payments" },
  { id: "onboarding", label: "Onboarding Flow", short: "Onboarding" },
  { id: "tenant", label: "Multi-tenant Architecture", short: "Tenancy" },
  { id: "services", label: "Services Map", short: "Services" },
];

const NODE_STYLES: Record<
  NodeColor,
  { bg: string; border: string; text: string; dot: string }
> = {
  gray: {
    bg: "bg-slate-50 dark:bg-slate-900/40",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-200",
    dot: "bg-slate-400",
  },
  purple: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-800 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  blue: {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-800 dark:text-sky-200",
    dot: "bg-sky-500",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  yellow: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-800 dark:text-orange-200",
    dot: "bg-orange-500",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-200 dark:border-pink-800",
    text: "text-pink-800 dark:text-pink-200",
    dot: "bg-pink-500",
  },
};

const SERVICE_BADGES = [
  { name: "Omnidim", color: "purple" as const },
  { name: "MySQL", color: "green" as const },
  { name: "Stripe", color: "blue" as const },
  { name: "Razorpay", color: "orange" as const },
  { name: "Twilio", color: "pink" as const },
  { name: "SendGrid", color: "purple" as const },
  { name: "Gemini", color: "yellow" as const },
];

const FLOW_DIAGRAMS: Record<
  FlowId,
  {
    title: string;
    caption: string;
    direction: "vertical" | "horizontal";
    nodes: Array<{ id: string; label: string; color: NodeColor; api?: string }>;
    edges: Array<{ from: string; to: string }>;
  }
> = {
  order: {
    title: "Voice order path",
    caption: "Primary path via Omnidim custom API tools (webhook is backup)",
    direction: "vertical",
    nodes: [
      { id: "caller", label: "Customer call", color: "gray" },
      { id: "phone", label: "Omnidim phone", color: "purple" },
      { id: "agent", label: "Voice agent (LLM)", color: "purple" },
      {
        id: "menu",
        label: "Read menu",
        color: "blue",
        api: "GET /api/integrations/omnidim/menu",
      },
      {
        id: "order",
        label: "Create order",
        color: "blue",
        api: "POST /api/integrations/omnidim/create-order",
      },
      { id: "mysql", label: "MySQL orders", color: "green" },
      {
        id: "pay",
        label: "Send payment link",
        color: "blue",
        api: "POST /api/integrations/omnidim/send-payment-link",
      },
      { id: "notify", label: "Twilio / SendGrid", color: "pink" },
    ],
    edges: [
      { from: "caller", to: "phone" },
      { from: "phone", to: "agent" },
      { from: "agent", to: "menu" },
      { from: "agent", to: "order" },
      { from: "order", to: "mysql" },
      { from: "agent", to: "pay" },
      { from: "pay", to: "mysql" },
      { from: "pay", to: "notify" },
    ],
  },
  reservation: {
    title: "Table reservation path",
    caption: "Same voice agent, different custom API tool",
    direction: "vertical",
    nodes: [
      { id: "caller", label: "Customer call", color: "gray" },
      { id: "agent", label: "Voice agent", color: "purple" },
      {
        id: "info",
        label: "Restaurant info",
        color: "blue",
        api: "GET /api/integrations/omnidim/restaurant",
      },
      {
        id: "book",
        label: "Create reservation",
        color: "blue",
        api: "POST /api/integrations/omnidim/create-reservation",
      },
      { id: "mysql", label: "MySQL reservations", color: "green" },
      { id: "confirm", label: "Verbal confirmation", color: "gray" },
    ],
    edges: [
      { from: "caller", to: "agent" },
      { from: "agent", to: "info" },
      { from: "agent", to: "book" },
      { from: "book", to: "mysql" },
      { from: "mysql", to: "confirm" },
    ],
  },
  payment: {
    title: "Payment link delivery",
    caption: "Triggered by agent tool, dashboard, or Omnidim webhook backup",
    direction: "vertical",
    nodes: [
      { id: "trigger", label: "Order created", color: "gray" },
      { id: "gateway", label: "Stripe / Razorpay", color: "orange" },
      { id: "link", label: "Hosted pay URL", color: "blue" },
      { id: "sms", label: "Twilio SMS", color: "pink" },
      { id: "email", label: "SendGrid email", color: "purple" },
      {
        id: "webhook",
        label: "Payment webhook",
        color: "blue",
        api: "POST /api/webhooks/stripe | razorpay",
      },
      { id: "paid", label: "Order paid", color: "green" },
    ],
    edges: [
      { from: "trigger", to: "gateway" },
      { from: "gateway", to: "link" },
      { from: "link", to: "sms" },
      { from: "link", to: "email" },
      { from: "link", to: "webhook" },
      { from: "webhook", to: "paid" },
    ],
  },
  onboarding: {
    title: "Restaurant onboarding wizard",
    caption: "Account → profile → menu → voice → agent → phone → go live",
    direction: "vertical",
    nodes: [
      { id: "account", label: "Register / login", color: "gray" },
      { id: "profile", label: "Restaurant profile", color: "green" },
      { id: "upload", label: "Menu PDF / image / URL", color: "yellow" },
      { id: "gemini", label: "Gemini extract", color: "yellow" },
      { id: "prompt", label: "Generate prompt", color: "purple" },
      {
        id: "agent",
        label: "Create agent",
        color: "purple",
        api: "POST /api/onboarding/agent",
      },
      { id: "provision", label: "Auto-provision 6 API tools", color: "blue" },
      { id: "phone", label: "Attach phone number", color: "purple" },
      { id: "live", label: "Go live / web demo", color: "green" },
    ],
    edges: [
      { from: "account", to: "profile" },
      { from: "profile", to: "upload" },
      { from: "upload", to: "gemini" },
      { from: "gemini", to: "prompt" },
      { from: "prompt", to: "agent" },
      { from: "agent", to: "provision" },
      { from: "provision", to: "phone" },
      { from: "phone", to: "live" },
    ],
  },
  tenant: {
    title: "Multi-tenant isolation",
    caption: "Every query scoped by restaurant_id — no cross-tenant defaults",
    direction: "horizontal",
    nodes: [
      { id: "dash", label: "Dashboard user", color: "gray" },
      { id: "session", label: "Session cookie", color: "blue" },
      { id: "agent", label: "Omnidim agent call", color: "purple" },
      { id: "key", label: "Integration API key", color: "blue" },
      { id: "resolve", label: "Resolve restaurant_id", color: "green" },
      { id: "mysql", label: "Scoped MySQL queries", color: "green" },
      { id: "webhook", label: "Webhook tenant lookup", color: "orange" },
    ],
    edges: [
      { from: "dash", to: "session" },
      { from: "session", to: "resolve" },
      { from: "agent", to: "key" },
      { from: "key", to: "resolve" },
      { from: "webhook", to: "resolve" },
      { from: "resolve", to: "mysql" },
    ],
  },
  services: {
    title: "Platform service map",
    caption: "External services and Cherry Voice API relationships",
    direction: "horizontal",
    nodes: [
      { id: "omnidim", label: "Omnidim", color: "purple" },
      { id: "cherry", label: "Cherry Voice API", color: "blue" },
      { id: "mysql", label: "MySQL", color: "green" },
      { id: "gemini", label: "Gemini", color: "yellow" },
      { id: "stripe", label: "Stripe", color: "blue" },
      { id: "razorpay", label: "Razorpay", color: "orange" },
      { id: "twilio", label: "Twilio", color: "pink" },
      { id: "sendgrid", label: "SendGrid", color: "purple" },
    ],
    edges: [
      { from: "omnidim", to: "cherry" },
      { from: "cherry", to: "mysql" },
      { from: "cherry", to: "gemini" },
      { from: "cherry", to: "stripe" },
      { from: "cherry", to: "razorpay" },
      { from: "cherry", to: "twilio" },
      { from: "cherry", to: "sendgrid" },
      { from: "omnidim", to: "mysql" },
    ],
  },
};

const FLOW_STEPS: Record<FlowId, string[]> = {
  order: [
    "Customer dials the restaurant's Omnidim-attached phone number (or uses browser web call).",
    "Omnidim runs STT → LLM agent with restaurant prompt and six custom API tools.",
    "Agent calls GET /api/integrations/omnidim/menu to read structured menu from MySQL.",
    "Agent calls POST /api/integrations/omnidim/create-order with items, phone, order_type.",
    "Cherry Voice API validates integration key, creates order + customer in MySQL.",
    "Agent optionally calls POST /api/integrations/omnidim/send-payment-link.",
    "Stripe or Razorpay creates hosted link; Twilio/SendGrid delivers SMS or email.",
    "Backup: POST /api/webhooks/omnidim can also create orders from post-call events.",
  ],
  reservation: [
    "Same inbound call path through Omnidim voice agent.",
    "Agent may call GET /api/integrations/omnidim/restaurant for hours and policies.",
    "Guest provides name, phone, party size, and datetime.",
    "Agent calls POST /api/integrations/omnidim/create-reservation.",
    "Reservation stored in MySQL with status confirmed; agent confirms verbally.",
    "Dashboard manages reservations via GET/PATCH /api/reservations.",
  ],
  payment: [
    "Order exists in MySQL with total_amount and customer contact.",
    "createPaymentLinkForOrder resolves default gateway (Stripe or Razorpay).",
    "Gateway returns hosted URL; payments row persisted; order payment_status = link_sent.",
    "sendPaymentLinkForOrder sends SMS (Twilio) and/or email (SendGrid).",
    "Customer pays; gateway POSTs to /api/webhooks/stripe or /api/webhooks/razorpay.",
    "Webhook handler marks payment paid and updates order status.",
  ],
  onboarding: [
    "Step 1 — POST /api/auth/register or /api/auth/login (session cookie).",
    "Step 2 — PATCH /api/settings with restaurant profile, hours, delivery area.",
    "Step 3 — Upload menu via /api/onboarding/menu/upload-* or website snapshot.",
    "Step 4 — POST /api/onboarding/extract runs Gemini → menu_items + agent context.",
    "Step 5 — Pick voice from /api/omnidim/providers; POST /api/onboarding/agent.",
    "Step 6 — provisionAgentWithIntegrations creates 6 Omnidim custom API hooks.",
    "Step 7 — POST /api/omnidim/phone-numbers/attach links inbound number.",
    "Step 8 — Web call demo via /api/omnidim/web-calls; dashboard go-live.",
  ],
  tenant: [
    "Dashboard APIs use requireRestaurantId() from session cookie — never a default tenant.",
    "Agent→API calls authenticate with per-restaurant integration key (Bearer or X-Restaurant-Key).",
    "restaurant_integration_keys table maps key → restaurant_id.",
    "omnidim_agents maps omnidim agent id → restaurant_id for webhook resolution.",
    "Webhooks resolve tenant from payload agent_id or dialed phone_number.",
    "All domain tables (orders, menu, customers, reservations) include restaurant_id FK.",
  ],
  services: [
    "Omnidim owns realtime voice: telephony, transcription, LLM, TTS, tool orchestration.",
    "Cherry Voice API is the restaurant domain layer on Next.js + MySQL.",
    "Gemini fills gaps Omnidim cannot: menu OCR, website scrape, structured extraction.",
    "Payments are per-restaurant gateway config; notifications are per-restaurant Twilio/SendGrid.",
    "Omnidim KB (PDF only) supplements RAG; structured menu always lives in MySQL.",
  ],
};

const SERVICE_META = [
  {
    name: "Omnidim",
    color: "purple" as const,
    role: "Voice AI platform — agents, calls, STT/TTS/LLM, phone numbers, custom API tool calls",
    usedIn: "Agent create, inbound calls, web sessions, integrations.attach",
  },
  {
    name: "Cherry Voice API",
    color: "blue" as const,
    role: "Next.js REST layer — tenant auth, orders, menu, reservations, webhooks",
    usedIn: "/api/integrations/omnidim/*, dashboard routes, webhooks",
  },
  {
    name: "MySQL",
    color: "green" as const,
    role: "Primary datastore — all domain tables scoped by restaurant_id",
    usedIn: "orders, menu_items, reservations, customers, omnidim_agents mapping",
  },
  {
    name: "Gemini",
    color: "yellow" as const,
    role: "Menu OCR, PDF/website extraction, agent prompt enrichment",
    usedIn: "onboarding/extract, menu/extract, generate-prompt",
  },
  {
    name: "Stripe",
    color: "blue" as const,
    role: "Hosted payment links + webhook confirmation",
    usedIn: "payments/create-link, webhooks/stripe",
  },
  {
    name: "Razorpay",
    color: "orange" as const,
    role: "Hosted payment links (INR) + webhook confirmation",
    usedIn: "payments/create-link, webhooks/razorpay",
  },
  {
    name: "Twilio",
    color: "pink" as const,
    role: "SMS delivery for payment links and notifications",
    usedIn: "send-payment-link, settings/notifications",
  },
  {
    name: "SendGrid",
    color: "purple" as const,
    role: "Transactional email for payment links",
    usedIn: "send-payment-link, settings/notifications",
  },
];

const INTEGRATION_TOOLS = [
  { tool: "create_order", method: "POST", path: "/api/integrations/omnidim/create-order" },
  { tool: "get_menu", method: "GET", path: "/api/integrations/omnidim/menu" },
  { tool: "lookup_customer", method: "GET", path: "/api/integrations/omnidim/customer?phone=" },
  { tool: "send_payment_link", method: "POST", path: "/api/integrations/omnidim/send-payment-link" },
  { tool: "create_reservation", method: "POST", path: "/api/integrations/omnidim/create-reservation" },
  { tool: "get_restaurant_info", method: "GET", path: "/api/integrations/omnidim/restaurant" },
];

const STATS = [
  { label: "Custom API tools", value: "6", icon: Zap },
  { label: "Payment gateways", value: "2", icon: Server },
  { label: "Notification channels", value: "SMS + Email", icon: Layers },
  { label: "Onboarding steps", value: "7", icon: ChevronRight },
];

function computeRanks(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string }>,
): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    children.set(id, []);
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    children.get(edge.from)?.push(edge.to);
  }

  const ranks: string[][] = [];
  const assigned = new Set<string>();
  let frontier = [...nodeIds].filter((id) => (inDegree.get(id) ?? 0) === 0);

  while (frontier.length > 0) {
    ranks.push(frontier);
    frontier.forEach((id) => assigned.add(id));
    const next = new Set<string>();
    for (const id of frontier) {
      for (const child of children.get(id) ?? []) {
        const parents = edges.filter((e) => e.to === child).map((e) => e.from);
        if (parents.every((p) => assigned.has(p))) {
          next.add(child);
        }
      }
    }
    frontier = [...next].filter((id) => !assigned.has(id));
  }

  const unassigned = [...nodeIds].filter((id) => !assigned.has(id));
  if (unassigned.length > 0) ranks.push(unassigned);

  return ranks;
}

function FlowNode({
  label,
  color,
  api,
  compact,
}: {
  label: string;
  color: NodeColor;
  api?: string;
  compact?: boolean;
}) {
  const style = NODE_STYLES[color];
  return (
    <div
      className={cn(
        "relative rounded-xl border-2 shadow-soft transition-shadow hover:shadow-card",
        style.bg,
        style.border,
        compact ? "min-w-[120px] px-3 py-2" : "min-w-[140px] max-w-[200px] px-4 py-3",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", style.dot)} />
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold leading-tight", style.text)}>{label}</p>
          {api && (
            <p className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground">
              {api}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowConnector({ direction }: { direction: "vertical" | "horizontal" }) {
  if (direction === "horizontal") {
    return (
      <div className="flex shrink-0 items-center px-1 text-muted-foreground/60">
        <ArrowRight className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex justify-center py-1 text-muted-foreground/60">
      <ArrowDown className="h-4 w-4" />
    </div>
  );
}

function FlowDiagram({ flowId }: { flowId: FlowId }) {
  const diagram = FLOW_DIAGRAMS[flowId];
  const nodeById = useMemo(
    () => new Map(diagram.nodes.map((n) => [n.id, n])),
    [diagram.nodes],
  );
  const ranks = useMemo(
    () => computeRanks(diagram.nodes, diagram.edges),
    [diagram.nodes, diagram.edges],
  );

  if (diagram.direction === "horizontal") {
    return (
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-1 px-2 py-4">
          {ranks.map((rank, ri) => (
            <div key={`rank-${ri}`} className="flex items-center">
              {ri > 0 && <FlowConnector direction="horizontal" />}
              <div className="flex flex-col gap-3">
                {rank.map((id) => {
                  const node = nodeById.get(id);
                  if (!node) return null;
                  return (
                    <FlowNode
                      key={id}
                      label={node.label}
                      color={node.color}
                      api={node.api}
                      compact
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-2 py-4">
      {ranks.map((rank, ri) => (
        <div key={`rank-${ri}`} className="flex w-full flex-col items-center">
          {ri > 0 && <FlowConnector direction="vertical" />}
          <div
            className={cn(
              "flex flex-wrap justify-center gap-3",
              rank.length > 1 && "rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4",
            )}
          >
            {rank.map((id) => {
              const node = nodeById.get(id);
              if (!node) return null;
              return (
                <FlowNode
                  key={id}
                  label={node.label}
                  color={node.color}
                  api={node.api}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServiceBadge({ name, color }: { name: string; color: NodeColor }) {
  const style = NODE_STYLES[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        style.bg,
        style.border,
        style.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {name}
    </span>
  );
}

type LandingArchitectureProps = {
  /** When true, omit outer section wrapper (for dedicated page). */
  embedded?: boolean;
};

export function LandingArchitecture({ embedded = false }: LandingArchitectureProps) {
  const [activeFlow, setActiveFlow] = useState<FlowId>("order");
  const diagram = FLOW_DIAGRAMS[activeFlow];

  const content = (
    <>
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          System architecture
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          How Cherry Voice AI connects everything
        </h2>
        <p className="mt-4 text-muted-foreground">
          Omnidim handles realtime voice. Cherry Voice API owns menu, orders,
          reservations, payments, and tenant isolation in MySQL.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SERVICE_BADGES.map((badge) => (
            <ServiceBadge key={badge.name} name={badge.name} color={badge.color} />
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {FLOW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFlow(tab.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-all",
              activeFlow === tab.id
                ? "border-primary bg-primary text-primary-foreground shadow-glow"
                : "border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeFlow}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-8"
        >
          <div
            className={cn(
              "grid gap-6",
              activeFlow === "services" ? "lg:grid-cols-1" : "lg:grid-cols-2",
            )}
          >
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft sm:p-6">
              <div className="mb-4">
                <h3 className="font-display text-lg font-bold">{diagram.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{diagram.caption}</p>
              </div>
              <FlowDiagram flowId={activeFlow} />
            </div>

            {activeFlow !== "services" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft sm:p-6">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <ChevronRight className="h-4 w-4 text-primary" />
                    Step-by-step
                  </h4>
                  <ol className="mt-4 space-y-3">
                    {FLOW_STEPS[activeFlow].map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {(activeFlow === "order" ||
                  activeFlow === "reservation" ||
                  activeFlow === "payment") && (
                  <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 p-4 dark:border-sky-800/40 dark:bg-sky-950/20">
                    <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                      Agent custom API tools
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Auto-provisioned on agent create via provisionAgentWithIntegrations —
                      auth with Bearer or X-Restaurant-Key header.
                    </p>
                  </div>
                )}

                {activeFlow === "tenant" && (
                  <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex items-start gap-2">
                      <Shield className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                          No cross-tenant defaults
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Webhooks never guess a default tenant. Unresolved tenant → event
                          logged as ignored.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {activeFlow === "services" && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
              <div className="border-b border-border/60 px-5 py-4">
                <h4 className="font-semibold">External services matrix</h4>
                <p className="text-xs text-muted-foreground">8 integrated services</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3 font-semibold">Service</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                      <th className="px-5 py-3 font-semibold">Touchpoints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SERVICE_META.map((service) => (
                      <tr
                        key={service.name}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-5 py-3">
                          <ServiceBadge name={service.name} color={service.color} />
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{service.role}</td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {service.usedIn}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/60 bg-card p-4 text-center shadow-soft"
          >
            <stat.icon className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 font-display text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
          <Key className="h-4 w-4 text-primary" />
          <h4 className="font-semibold">Omnidim agent integration endpoints</h4>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            6 tools
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Tool name</th>
                <th className="px-5 py-3 font-semibold">Method</th>
                <th className="px-5 py-3 font-semibold">Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {INTEGRATION_TOOLS.map((row) => (
                <tr key={row.tool} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs font-medium">{row.tool}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-xs font-bold",
                        row.method === "POST"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
                      )}
                    >
                      {row.method}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {row.path}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border/60 bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Dashboard path: </span>
              Session cookie → requireRestaurantId() → all queries include restaurant_id.
            </p>
            <p>
              <span className="font-semibold text-foreground">Voice agent path: </span>
              Integration key in Authorization header → restaurant_integration_keys lookup →
              scoped handler.
            </p>
            <p>
              <span className="font-semibold text-foreground">Webhook path: </span>
              agent_id or dialed phone → omnidim_agents mapping → reject if tenant unresolved.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{content}</div>;
  }

  return (
    <section id="architecture" className="border-t border-border/40 bg-muted/10 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{content}</div>
    </section>
  );
}
