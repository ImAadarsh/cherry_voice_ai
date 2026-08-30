"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Bot, MoreHorizontal, Store, Globe } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderDetail } from "@/components/orders/order-detail";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { api } from "@/lib/api-client";
import { mapOrderRow } from "@/lib/mappers";
import { cn, formatRelativeTime, initials } from "@/lib/utils";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badge";
import type { Order, OrderStatus } from "@/types";

const filters: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Preparing", value: "preparing" },
  { label: "Ready", value: "ready" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const channelIcon = { voice: Bot, web: Globe, "walk-in": Store };

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersView />
    </Suspense>
  );
}

const statusToDb: Record<OrderStatus, string> = {
  pending: "pending",
  paid: "confirmed",
  preparing: "preparing",
  ready: "ready",
  completed: "completed",
  cancelled: "cancelled",
};

function OrdersView() {
  const { formatMajor } = useCurrency();
  const params = useSearchParams();
  const { data, loading, error, retry } = useApiQuery<{
    data: Array<Record<string, unknown> & { items?: Array<Record<string, unknown>> }>;
  }>("/api/orders?limit=200");

  const [items, setItems] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (data?.data) setItems(data.data.map((row) => mapOrderRow(row, row.items ?? [])));
  }, [data]);

  useEffect(() => {
    const focus = params.get("focus");
    if (focus && items.length) {
      const o = items.find((x) => x.id === focus);
      if (o) {
        setSelected(o);
        setOpen(true);
      }
    }
  }, [params, items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((o) => o.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: items.length };
    for (const o of items) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [items]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    try {
      await api.patch(`/api/orders/${id}`, { status: statusToDb[status] });
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      setSelected((s) => (s && s.id === id ? { ...s, status } : s));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openOrder = (o: Order) => {
    setSelected(o);
    setOpen(true);
  };

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: "reference",
        header: "Order #",
        cell: ({ row }) => {
          const Ch = channelIcon[row.original.channel];
          return (
            <div className="flex items-center gap-2 font-semibold">
              <Ch className="h-3.5 w-3.5 text-muted-foreground" />
              {row.original.reference}
            </div>
          );
        },
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-muted text-[10px] font-semibold">
                {initials(row.original.customerName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.original.customerName}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">
                {row.original.customerPhone}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "items",
        header: "Items",
        accessorFn: (row) => row.items.reduce((s, i) => s + i.qty, 0),
        cell: ({ getValue }) => (
          <span className="font-medium text-muted-foreground">
            {getValue() as number} items
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="tabular font-bold">
            {formatMajor(row.original.total)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "paymentStatus",
        header: "Payment",
        cell: ({ row }) => (
          <PaymentStatusBadge status={row.original.paymentStatus} />
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span className="font-medium text-muted-foreground">
            {formatRelativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openOrder(row.original)}>
                View details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [formatMajor],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Track and manage every order across all channels."
      >
        <Button size="sm">New order</Button>
      </PageHeader>

      {error ? (
        <Card className="p-8 text-center">
          <p className="font-semibold">Failed to load orders</p>
          <Button className="mt-4" size="sm" onClick={retry}>
            Retry
          </Button>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchKey="customerName"
          searchPlaceholder="Search by customer or order #…"
          emptyTitle="No orders found"
          emptyDescription="Try changing filters or search terms. New orders appear here in real time."
          pageSize={10}
          onRowClick={openOrder}
          toolbar={
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
                    filter === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {f.label}
                  {(counts[f.value] ?? 0) > 0 && (
                    <span className="tabular rounded-full bg-muted px-1.5 text-[11px] font-bold">
                      {counts[f.value] ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
          }
          mobileCard={(o) => {
            const Ch = channelIcon[o.channel];
            return (
              <Card className="p-4 active:scale-[0.99]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-muted text-[11px] font-semibold">
                        {initials(o.customerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{o.customerName}</p>
                      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Ch className="h-3 w-3" /> {o.reference} ·{" "}
                        {formatRelativeTime(o.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="tabular font-bold">{formatMajor(o.total)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <OrderStatusBadge status={o.status} />
                  <PaymentStatusBadge status={o.paymentStatus} />
                  <span className="ml-auto text-xs font-medium text-muted-foreground">
                    {o.items.reduce((s, i) => s + i.qty, 0)} items
                  </span>
                </div>
              </Card>
            );
          }}
        />
      )}

      <OrderDetail
        order={selected}
        open={open}
        onOpenChange={setOpen}
        onStatusChange={updateStatus}
      />
    </div>
  );
}
