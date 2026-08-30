"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CreditCard,
  Landmark,
  Wallet,
  Link2,
  DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { mapPaymentRow } from "@/lib/mappers";
import { formatRelativeTime } from "@/lib/utils";
import type { Payment } from "@/types";

const methodIcon = {
  card: CreditCard,
  upi: Landmark,
  wallet: Wallet,
  cash: DollarSign,
  link: Link2,
};

const linkStatusVariant = {
  sent: "info",
  opened: "warning",
  paid: "success",
  expired: "muted",
} as const;

export default function PaymentsPage() {
  const { formatMajor } = useCurrency();
  const { data, loading } = useApiQuery<{
    data: Array<Record<string, unknown>>;
  }>("/api/payments?limit=200");
  const payments = useMemo(
    () => (data?.data ?? []).map((row) => mapPaymentRow(row)),
    [data],
  );

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status === "pending");
  const successRate =
    payments.length > 0
      ? Math.round(
          (payments.filter((p) => p.status === "paid").length / payments.length) *
            1000,
        ) / 10
      : 0;

  const columns = useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">
            #{row.original.id.slice(-6)}
          </span>
        ),
      },
      {
        accessorKey: "orderRef",
        header: "Order",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.orderRef}</p>
            <p className="text-xs font-medium text-muted-foreground">
              {row.original.customerName}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="tabular font-bold">
            {formatMajor(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: "gateway",
        header: "Gateway",
        cell: ({ row }) => (
          <span className="capitalize font-semibold text-muted-foreground">
            {row.original.gateway}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <PaymentStatusBadge status={row.original.status} />
            {row.original.linkStatus && (
              <Badge variant={linkStatusVariant[row.original.linkStatus]}>
                link {row.original.linkStatus}
              </Badge>
            )}
          </div>
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
    ],
    [formatMajor],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Transactions, payment links and gateway configuration."
      >
        <Button size="sm" className="gap-2 font-semibold">
          <Link2 className="h-4 w-4" /> New payment link
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Collected" value={formatMajor(totalPaid)} />
        <MiniStat
          label="Pending"
          value={formatMajor(pending.reduce((s, p) => s + p.amount, 0))}
        />
        <MiniStat
          label="Transactions"
          value={String(payments.length)}
        />
        <MiniStat label="Success rate" value={`${successRate}%`} />
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history" className="font-semibold">
            History
          </TabsTrigger>
          <TabsTrigger value="gateways" className="font-semibold">
            Gateways
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <DataTable
            columns={columns}
            data={payments}
            loading={loading}
            searchKey="orderRef"
            searchPlaceholder="Search by order or customer…"
            emptyTitle="No payments"
            emptyDescription="Payment transactions will appear here."
            pageSize={10}
            mobileCard={(p) => {
              const Icon = methodIcon[p.method];
              return (
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.customerName}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {p.orderRef} · {p.gateway}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-bold">{formatMajor(p.amount)}</p>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </div>
                </Card>
              );
            }}
          />
        </TabsContent>

        <TabsContent value="gateways" className="mt-4 space-y-4">
          <Card className="p-6">
            <p className="font-semibold">Gateway configuration</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Manage Stripe and Razorpay in Settings → Payments.
            </p>
            <Button className="mt-4" size="sm" variant="outline" asChild>
              <a href="/settings">Open settings</a>
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="tabular text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
    </Card>
  );
}
