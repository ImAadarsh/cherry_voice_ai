"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Bot, Receipt, Users, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/shared/states";
import { RoleBadge } from "@/components/super-admin/role-badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";

type RestaurantResponse = { restaurant: Record<string, unknown> };
type UsersResponse = { users: Array<Record<string, unknown>> };
type AgentsResponse = { agents: Array<Record<string, unknown>> };
type OrdersResponse = { orders: Array<Record<string, unknown>> };

export default function SuperAdminRestaurantDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, loading, error, retry } = useApiQuery<RestaurantResponse>(
    id ? `/api/super-admin/restaurants/${id}` : null,
  );
  const { data: usersData, loading: usersLoading } = useApiQuery<UsersResponse>(
    id ? `/api/super-admin/users?restaurant_id=${id}&limit=50` : null,
  );
  const { data: agentsData, loading: agentsLoading } = useApiQuery<AgentsResponse>(
    id ? `/api/super-admin/agents?restaurant_id=${id}&limit=50` : null,
  );
  const { data: ordersData, loading: ordersLoading } = useApiQuery<OrdersResponse>(
    id ? `/api/super-admin/orders?restaurant_id=${id}&limit=10` : null,
  );

  const impersonate = async () => {
    try {
      const res = await api.patch<{ impersonation: { redirectUrl: string } }>(
        `/api/super-admin/restaurants/${id}`,
        { impersonate: true },
      );
      toast.success("Impersonating restaurant owner");
      window.location.href = res.impersonation.redirectUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impersonation failed");
    }
  };

  if (error) return <ErrorState onRetry={retry} />;
  if (!loading && !data?.restaurant) return <ErrorState title="Restaurant not found" />;

  const r = data?.restaurant ?? {};
  const name = String(r.name ?? "Restaurant");

  const userColumns: ColumnDef<Record<string, unknown>>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <RoleBadge role={String(row.original.role)} />,
    },
    {
      accessorKey: "last_login_at",
      header: "Last login",
      cell: ({ row }) =>
        row.original.last_login_at
          ? new Date(String(row.original.last_login_at)).toLocaleString()
          : "Never",
    },
  ];

  const orderColumns: ColumnDef<Record<string, unknown>>[] = [
    { accessorKey: "order_number", header: "Order #" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {String(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ row }) =>
        formatCurrency(Number(row.original.total_amount) / 100, String(row.original.currency)),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => new Date(String(row.original.created_at)).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="text-zinc-400">
          <Link href="/super-admin/restaurants">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-white">{name}</h1>
            <Badge variant={r.status === "active" ? "success" : "secondary"} className="capitalize">
              {String(r.status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {String(r.slug)} · {[r.city, r.country].filter(Boolean).join(", ") || "No location"}
          </p>
        </div>
        <Button variant="outline" className="gap-1.5 border-white/10" onClick={impersonate}>
          <UserCog className="h-4 w-4" /> Impersonate owner
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Users", value: r.user_count, icon: Users },
          { label: "Menu items", value: r.menu_count, icon: Receipt },
          { label: "Voice agents", value: r.agent_count, icon: Bot },
          { label: "Orders", value: r.order_count, icon: Receipt },
        ].map((stat) => (
          <Card key={stat.label} className="border-white/[0.06] bg-[#111113] p-5">
            <div className="flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
                <p className="tabular text-2xl font-bold text-white">{String(stat.value ?? 0)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">Tenant details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-zinc-500">Email</p>
            <p className="font-medium text-zinc-200">{String(r.email ?? "—")}</p>
          </div>
          <div>
            <p className="text-zinc-500">Phone</p>
            <p className="font-medium text-zinc-200">{String(r.phone ?? "—")}</p>
          </div>
          <div>
            <p className="text-zinc-500">Revenue (paid)</p>
            <p className="font-medium text-zinc-200">
              {formatCurrency(Number(r.revenue_total ?? 0) / 100, String(r.currency ?? "USD"))}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Calls</p>
            <p className="font-medium text-zinc-200">{String(r.call_count ?? 0)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Created</p>
            <p className="font-medium text-zinc-200">
              {r.created_at ? new Date(String(r.created_at)).toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Timezone</p>
            <p className="font-medium text-zinc-200">{String(r.timezone ?? "UTC")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/[0.06] bg-[#111113]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Users ({usersData?.users.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={userColumns}
              data={usersData?.users ?? []}
              loading={usersLoading || loading}
              pageSize={8}
            />
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-[#111113]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Voice agents ({agentsData?.agents.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentsLoading || loading ? (
              <div className="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
            ) : (agentsData?.agents ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">No voice agents provisioned</p>
            ) : (
              (agentsData?.agents ?? []).map((a) => (
                <div
                  key={String(a.id)}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{String(a.name)}</p>
                    <p className="text-xs text-zinc-500">{String(a.phone_number ?? "No number")}</p>
                  </div>
                  <Badge variant={a.is_active ? "success" : "secondary"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={orderColumns}
            data={ordersData?.orders ?? []}
            loading={ordersLoading || loading}
            pageSize={8}
            emptyTitle="No orders yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
