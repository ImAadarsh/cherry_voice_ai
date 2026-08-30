"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Users, Receipt, PhoneCall } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { toMajor } from "@/lib/currency";

type RestaurantRow = {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  currency: string;
  status: string;
  user_count: number;
  order_count: number;
  call_count: number;
  revenue_total: number;
  created_at: string;
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { formatMajor } = useCurrency();
  const isAdmin = user?.role === "platform_admin";

  const { data, loading, error, retry } = useApiQuery<{
    restaurants: RestaurantRow[];
    stats: { restaurants: number; orders: number; calls: number; customers: number };
  }>(isAdmin ? "/api/admin/restaurants" : null);

  if (!authLoading && !isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Platform Admin" description="Super-admin access required." />
        <ErrorState
          title="Access denied"
          description="Sign in as a platform admin (admin@cherryvoice.test) to manage all restaurants."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Platform Admin" />
        <ErrorState onRetry={retry} />
      </div>
    );
  }

  const stats = data?.stats;
  const restaurants = data?.restaurants ?? [];

  const columns: ColumnDef<RestaurantRow>[] = [
    {
      accessorKey: "name",
      header: "Restaurant",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      ),
    },
    {
      id: "location",
      header: "Location",
      accessorFn: (r) => [r.city, r.country].filter(Boolean).join(", ") || "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "success" : "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "order_count",
      header: "Orders",
      cell: ({ row }) => <span className="font-bold">{row.original.order_count}</span>,
    },
    {
      accessorKey: "call_count",
      header: "Calls",
      cell: ({ row }) => <span className="font-bold">{row.original.call_count}</span>,
    },
    {
      accessorKey: "revenue_total",
      header: "Revenue",
      cell: ({ row }) => (
        <span className="tabular font-bold">
          {formatMajor(toMajor(Number(row.original.revenue_total), row.original.currency))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Admin"
        description="Multi-restaurant SaaS overview — all tenants, usage, and health."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))
        ) : (
          <>
            <KpiCard label="Restaurants" value={String(stats?.restaurants ?? 0)} icon={Building2} accent="primary" />
            <KpiCard label="Total orders" value={String(stats?.orders ?? 0)} icon={Receipt} accent="info" />
            <KpiCard label="Total calls" value={String(stats?.calls ?? 0)} icon={PhoneCall} accent="warning" />
            <KpiCard label="Customers" value={String(stats?.customers ?? 0)} icon={Users} accent="success" />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All restaurants</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={restaurants}
            loading={loading}
            searchKey="name"
            searchPlaceholder="Search restaurants…"
            emptyTitle="No restaurants"
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}
