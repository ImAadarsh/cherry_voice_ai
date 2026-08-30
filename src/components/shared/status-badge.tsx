import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  OrderStatus,
  PaymentStatus,
  AgentStatus,
  CallOutcome,
} from "@/types";

const orderMap: Record<
  OrderStatus,
  { label: string; variant: "warning" | "info" | "success" | "muted" | "destructive" }
> = {
  pending: { label: "Pending", variant: "warning" },
  paid: { label: "Paid", variant: "info" },
  preparing: { label: "Preparing", variant: "info" },
  ready: { label: "Ready", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const m = orderMap[status];
  return (
    <Badge variant={m.variant} className="capitalize">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "pending" && "bg-warning",
          (status === "paid" || status === "preparing") && "bg-info",
          (status === "ready" || status === "completed") && "bg-success",
          status === "cancelled" && "bg-destructive"
        )}
      />
      {m.label}
    </Badge>
  );
}

const paymentMap: Record<
  PaymentStatus,
  { label: string; variant: "warning" | "success" | "muted" | "destructive" }
> = {
  unpaid: { label: "Unpaid", variant: "muted" },
  pending: { label: "Pending", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  refunded: { label: "Refunded", variant: "muted" },
  failed: { label: "Failed", variant: "destructive" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const m = paymentMap[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function AgentStatusDot({ status }: { status: AgentStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize">
      <span className="relative flex h-2 w-2">
        {status === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            status === "online" && "bg-success",
            status === "idle" && "bg-warning",
            status === "offline" && "bg-muted-foreground/40"
          )}
        />
      </span>
      {status}
    </span>
  );
}

const outcomeMap: Record<
  CallOutcome,
  { label: string; variant: "success" | "info" | "warning" | "muted" | "destructive" }
> = {
  order_placed: { label: "Order placed", variant: "success" },
  inquiry: { label: "Inquiry", variant: "info" },
  reservation: { label: "Reservation", variant: "info" },
  missed: { label: "Missed", variant: "destructive" },
  transferred: { label: "Transferred", variant: "warning" },
};

export function CallOutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const m = outcomeMap[outcome];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
