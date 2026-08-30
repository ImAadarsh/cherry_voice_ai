"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Phone,
  PlayCircle,
  Link2,
  Printer,
  ChefHat,
  CheckCircle2,
  XCircle,
  Bot,
  MessageCircle,
  Copy,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badge";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useCurrency } from "@/hooks/use-currency";
import { api } from "@/lib/api-client";
import { formatRelativeTime, initials } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

const statusToDb: Record<OrderStatus, string> = {
  pending: "pending",
  paid: "confirmed",
  preparing: "preparing",
  ready: "ready",
  completed: "completed",
  cancelled: "cancelled",
};

const nextActions: Record<
  OrderStatus,
  { label: string; to: OrderStatus; icon: typeof ChefHat }[]
> = {
  pending: [
    { label: "Mark paid", to: "paid", icon: CheckCircle2 },
    { label: "Start preparing", to: "preparing", icon: ChefHat },
  ],
  paid: [{ label: "Start preparing", to: "preparing", icon: ChefHat }],
  preparing: [{ label: "Mark ready", to: "ready", icon: CheckCircle2 }],
  ready: [{ label: "Mark completed", to: "completed", icon: CheckCircle2 }],
  completed: [],
  cancelled: [],
};

export function OrderDetail({
  order,
  open,
  onOpenChange,
  onStatusChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
}) {
  const isDesktop = useIsDesktop();
  const { formatMajor } = useCurrency();
  const [sending, setSending] = useState(false);

  if (!order) return null;

  const actions = nextActions[order.status];

  const patchStatus = async (to: OrderStatus) => {
    try {
      await api.patch(`/api/orders/${order.id}`, { status: statusToDb[to] });
      onStatusChange(order.id, to);
      toast.success(`Order ${to}`, { description: `${order.reference} updated.` });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const sendPaymentLink = async (channels: Array<"sms" | "whatsapp">) => {
    setSending(true);
    try {
      const res = await api.post<{ sends: Array<{ status: string; channel: string }> }>(
        `/api/orders/${order.id}/send-payment-link`,
        { channels },
      );
      const ok = res.sends?.every((s) => s.status !== "failed");
      toast[ok ? "success" : "warning"](ok ? "Payment link sent" : "Link created with warnings", {
        description: `Customer page link sent to ${order.customerName} via ${channels.join(" + ")}`,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const copyCustomerPageLink = async () => {
    if (!order.customerPageToken) {
      toast.error("No customer page link for this order");
      return;
    }
    const url = `${window.location.origin}/order/${order.customerPageToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md max-lg:h-[92svh] max-lg:rounded-t-2xl"
      >
        <SheetHeader className="sticky top-0 z-10 glass border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                {order.reference}
                {order.channel === "voice" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <Bot className="h-3 w-3" /> Voice
                  </span>
                )}
              </SheetTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRelativeTime(order.createdAt)}
                {order.eta && ` · ETA ${order.eta}`}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-6">
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-muted">
                {initials(order.customerName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{order.customerName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {order.customerPhone}
              </p>
            </div>
            <Button variant="outline" size="icon" aria-label="Call">
              <Phone className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Items
            </p>
            <ul className="space-y-1">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg px-1 py-2"
                >
                  <div className="flex gap-3">
                    <span className="tabular grid h-6 min-w-6 place-items-center rounded-md bg-muted px-1 text-xs font-semibold">
                      {item.qty}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.notes && (
                        <p className="text-xs text-primary">{item.notes}</p>
                      )}
                    </div>
                  </div>
                  <span className="tabular text-sm">
                    {formatMajor(item.price * item.qty)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatMajor(order.subtotal)} />
            <Row label="Tax" value={formatMajor(order.tax)} />
            <div className="flex items-center justify-between pt-1 text-base font-semibold">
              <span>Total</span>
              <span className="tabular">{formatMajor(order.total)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Payment</p>
              <p className="text-xs text-muted-foreground capitalize">
                {order.channel} order
              </p>
            </div>
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>

          {order.notes && (
            <div className="rounded-xl bg-warning/10 p-3 text-sm">
              <p className="mb-0.5 text-xs font-semibold text-warning-foreground dark:text-warning">
                Note
              </p>
              <p className="text-muted-foreground">{order.notes}</p>
            </div>
          )}

          {order.recordingUrl && (
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Call recording</p>
                  <p className="text-xs text-muted-foreground">
                    {order.callId}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast("Playing recording…")}
              >
                Play
              </Button>
            </div>
          )}
        </div>

        <div className="safe-bottom sticky bottom-0 space-y-2 border-t glass p-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              disabled={!order.customerPageToken}
              onClick={() => void copyCustomerPageLink()}
            >
              <Copy className="h-4 w-4" /> Copy link
            </Button>
            <Button
              variant="outline"
              disabled={sending || order.paymentStatus === "paid"}
              onClick={() => sendPaymentLink(["sms"])}
            >
              <Link2 className="h-4 w-4" /> SMS link
            </Button>
            <Button
              variant="outline"
              disabled={sending || order.paymentStatus === "paid"}
              onClick={() => sendPaymentLink(["whatsapp"])}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => toast("Printing ticket…")}>
            <Printer className="h-4 w-4" /> Print ticket
          </Button>
          {actions.length > 0 && (
            <div className="flex gap-2">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <Button
                    key={a.to}
                    className="flex-1"
                    onClick={() => patchStatus(a.to)}
                  >
                    <Icon className="h-4 w-4" /> {a.label}
                  </Button>
                );
              })}
              {order.status !== "cancelled" &&
                order.status !== "completed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label="Cancel order"
                    onClick={() => patchStatus("cancelled")}
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular text-foreground">{value}</span>
    </div>
  );
}
