"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/shared/states";
import { CreateRestaurantDialog } from "@/components/super-admin/create-restaurant-dialog";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatCurrency } from "@/lib/utils";

type RestaurantRow = {
  id: number;
  name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string | null;
  status: string;
  agent_count: number;
  order_count: number;
  revenue_total: number;
  currency: string;
  created_at: string;
};

export default function SuperAdminRestaurantsPage() {
  const router = useRouter();
  const { data, loading, error, retry, refetch } = useApiQuery<{ restaurants: RestaurantRow[] }>(
    "/api/super-admin/restaurants",
  );

  const columns: ColumnDef<RestaurantRow>[] = [
    {
      accessorKey: "name",
      header: "Restaurant",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-zinc-100">{row.original.name}</p>
          <p className="text-xs text-zinc-500">{row.original.slug}</p>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      accessorFn: (r) => r.owner_name ?? r.owner_email ?? "—",
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.owner_name ?? "—"}</p>
          {row.original.owner_email && (
            <p className="text-xs text-zinc-500">{row.original.owner_email}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "success" : "secondary"}
          className="capitalize"
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "agent_count",
      header: "Agents",
      cell: ({ row }) => <span className="tabular font-semibold">{row.original.agent_count}</span>,
    },
    {
      accessorKey: "order_count",
      header: "Orders",
      cell: ({ row }) => <span className="tabular font-semibold">{row.original.order_count}</span>,
    },
    {
      accessorKey: "revenue_total",
      header: "Revenue",
      cell: ({ row }) => (
        <span className="tabular font-semibold">
          {formatCurrency(Number(row.original.revenue_total) / 100, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-zinc-400">{new Date(row.original.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/super-admin/restaurants/${row.original.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" /> View details
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Restaurants</h1>
          <p className="text-sm text-zinc-500">All tenants on the platform</p>
        </div>
        <CreateRestaurantDialog onCreated={() => refetch()} />
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">
            {data?.restaurants.length ?? 0} restaurants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.restaurants ?? []}
            loading={loading}
            searchKey="name"
            searchPlaceholder="Search restaurants…"
            onRowClick={(row) => router.push(`/super-admin/restaurants/${row.id}`)}
            pageSize={15}
          />
        </CardContent>
      </Card>
    </div>
  );
}
