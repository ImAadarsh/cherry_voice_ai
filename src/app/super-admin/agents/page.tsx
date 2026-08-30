"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";

type AgentRow = {
  id: number;
  name: string;
  phone_number: string | null;
  direction: string;
  is_active: number;
  language: string | null;
  call_count: number;
  restaurant_id: number;
  restaurant_name: string;
  created_at: string;
  last_synced_at: string | null;
};

export default function SuperAdminAgentsPage() {
  const { data, loading, error, retry } = useApiQuery<{ agents: AgentRow[] }>(
    "/api/super-admin/agents",
  );

  const columns: ColumnDef<AgentRow>[] = [
    {
      accessorKey: "name",
      header: "AI Agent",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-zinc-100">{row.original.name}</p>
          <p className="text-xs text-zinc-500">Voice Agent</p>
        </div>
      ),
    },
    {
      accessorKey: "restaurant_name",
      header: "Restaurant",
    },
    {
      accessorKey: "phone_number",
      header: "Phone",
      cell: ({ row }) => row.original.phone_number ?? "—",
    },
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.direction}
        </Badge>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "success" : "secondary"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "call_count",
      header: "Calls",
      cell: ({ row }) => <span className="tabular font-semibold">{row.original.call_count}</span>,
    },
    {
      accessorKey: "language",
      header: "Language",
      cell: ({ row }) => row.original.language ?? "—",
    },
    {
      accessorKey: "last_synced_at",
      header: "Last synced",
      cell: ({ row }) =>
        row.original.last_synced_at
          ? new Date(row.original.last_synced_at).toLocaleString()
          : "—",
    },
  ];

  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Voice Agents</h1>
        <p className="text-sm text-zinc-500">All AI voice agents across the platform</p>
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">
            {data?.agents.length ?? 0} agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.agents ?? []}
            loading={loading}
            searchKey="name"
            searchPlaceholder="Search agents…"
            pageSize={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
