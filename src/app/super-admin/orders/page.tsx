"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatCurrency } from "@/lib/utils";

type OrderRow = {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  channel: string;
  total_amount: number;
  currency: string;
  customer_name: string | null;
  restaurant_id: number;
  restaurant_name: string;
  created_at: string;
};

function exportCsv(orders: OrderRow[]) {
  const headers = ["Order #", "Restaurant", "Status", "Payment", "Total", "Customer", "Date"];
  const rows = orders.map((o) => [
    o.order_number,
    o.restaurant_name,
    o.status,
    o.payment_status,
    (o.total_amount / 100).toFixed(2),
    o.customer_name ?? "",
    new Date(o.created_at).toISOString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SuperAdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const query = statusFilter !== "all" ? `/api/super-admin/orders?status=${statusFilter}` : "/api/super-admin/orders";
  const { data, loading, error, retry } = useApiQuery<{ orders: OrderRow[] }>(query);

  const columns: ColumnDef<OrderRow>[] = useMemo(
    () => [
      {
        accessorKey: "order_number",
        header: "Order #",
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.order_number}</span>,
      },
      {
        accessorKey: "restaurant_name",
        header: "Restaurant",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "payment_status",
        header: "Payment",
        cell: ({ row }) => (
          <Badge
            variant={row.original.payment_status === "paid" ? "success" : "secondary"}
            className="capitalize"
          >
            {row.original.payment_status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "total_amount",
        header: "Total",
        cell: ({ row }) => (
          <span className="tabular font-semibold">
            {formatCurrency(row.original.total_amount / 100, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "customer_name",
        header: "Customer",
        cell: ({ row }) => row.original.customer_name ?? "—",
      },
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
      },
    ],
    [],
  );

  if (error) return <ErrorState onRetry={retry} />;

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-zinc-500">Cross-tenant order history</p>
        </div>
        <Button
          variant="outline"
          className="gap-1.5 border-white/10"
          onClick={() => exportCsv(orders)}
          disabled={!orders.length}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-white">{orders.length} orders</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 border-white/10 bg-transparent">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={orders}
            loading={loading}
            searchKey="order_number"
            searchPlaceholder="Search order #…"
            pageSize={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
