"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChefHat, Clock, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { api } from "@/lib/api-client";
import { mapOrderRow } from "@/lib/mappers";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

const POLL_MS = 5000;

const statusToDb: Record<OrderStatus, string> = {
  pending: "pending",
  paid: "confirmed",
  preparing: "preparing",
  ready: "ready",
  completed: "completed",
  cancelled: "cancelled",
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  paid: "preparing",
  preparing: "ready",
  ready: "completed",
};

export default function KitchenPage() {
  const { formatMajor } = useCurrency();
  const { data, loading, refetch } = useApiQuery<{
    data: Array<Record<string, unknown> & { items?: Array<Record<string, unknown>> }>;
    polledAt?: string;
  }>("/api/kitchen/orders");

  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (data?.data) {
      setOrders(data.data.map((row) => mapOrderRow(row, row.items ?? [])));
    }
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => refetch(), POLL_MS);
    return () => clearInterval(t);
  }, [refetch]);

  const columns = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending" || o.status === "paid");
    const preparing = orders.filter((o) => o.status === "preparing");
    const ready = orders.filter((o) => o.status === "ready");
    return { pending, preparing, ready };
  }, [orders]);

  const advance = useCallback(async (order: Order) => {
    const next = nextStatus[order.status];
    if (!next) return;
    try {
      await api.patch(`/api/orders/${order.id}`, { status: statusToDb[next] });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
      toast.success(`Order ${order.reference} → ${next}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] space-y-4 bg-background">
      <PageHeader
        title="Kitchen Display"
        description="Live order board — auto-refreshes every 5 seconds."
      >
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KitchenColumn
          title="New / Paid"
          icon={Clock}
          accent="warning"
          orders={columns.pending}
          loading={loading}
          formatMajor={formatMajor}
          onAdvance={advance}
        />
        <KitchenColumn
          title="Preparing"
          icon={ChefHat}
          accent="info"
          orders={columns.preparing}
          loading={loading}
          formatMajor={formatMajor}
          onAdvance={advance}
        />
        <KitchenColumn
          title="Ready"
          icon={ChefHat}
          accent="success"
          orders={columns.ready}
          loading={loading}
          formatMajor={formatMajor}
          onAdvance={advance}
        />
      </div>
    </div>
  );
}

function KitchenColumn({
  title,
  icon: Icon,
  accent,
  orders,
  loading,
  formatMajor,
  onAdvance,
}: {
  title: string;
  icon: typeof ChefHat;
  accent: "warning" | "info" | "success";
  orders: Order[];
  loading: boolean;
  formatMajor: (n: number) => string;
  onAdvance: (o: Order) => void;
}) {
  const accentClass = {
    warning: "border-warning/40 bg-warning/5",
    info: "border-info/40 bg-info/5",
    success: "border-success/40 bg-success/5",
  }[accent];

  return (
    <div className={cn("rounded-2xl border-2 p-4", accentClass)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className="h-5 w-5" /> {title}
        </h2>
        <Badge variant="secondary">{orders.length}</Badge>
      </div>
      <div className="space-y-3">
        {loading && orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders</p>
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{o.reference}</p>
                  <p className="text-sm font-medium text-muted-foreground">{o.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(o.createdAt)}
                  </p>
                </div>
                <span className="tabular text-lg font-bold">{formatMajor(o.total)}</span>
              </div>
              <ul className="mt-3 space-y-1 border-t pt-3">
                {o.items.map((it) => (
                  <li key={it.id} className="flex justify-between text-sm">
                    <span>
                      <span className="font-bold">{it.qty}×</span> {it.name}
                    </span>
                  </li>
                ))}
              </ul>
              {o.notes && (
                <p className="mt-2 rounded bg-warning/10 px-2 py-1 text-xs">{o.notes}</p>
              )}
              {nextStatus[o.status] && (
                <Button className="mt-3 w-full" size="sm" onClick={() => onAdvance(o)}>
                  Mark {nextStatus[o.status]}
                </Button>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
