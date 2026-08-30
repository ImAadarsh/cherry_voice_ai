"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/shared/states";
import { RoleBadge } from "@/components/super-admin/role-badge";
import { useApiQuery } from "@/hooks/use-api-query";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  restaurant_id: number;
  restaurant_name: string;
};

export default function SuperAdminUsersPage() {
  const { data, loading, error, retry } = useApiQuery<{ users: UserRow[] }>(
    "/api/super-admin/users",
  );

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-zinc-100">{row.original.name}</p>
          <p className="text-xs text-zinc-500">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "restaurant_name",
      header: "Restaurant",
      cell: ({ row }) => (
        <span className="text-zinc-300">{row.original.restaurant_name}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
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
      accessorKey: "last_login_at",
      header: "Last login",
      cell: ({ row }) =>
        row.original.last_login_at
          ? new Date(row.original.last_login_at).toLocaleString()
          : <span className="text-zinc-500">Never</span>,
    },
    {
      accessorKey: "created_at",
      header: "Joined",
      cell: ({ row }) => (
        <span className="text-zinc-400">
          {new Date(row.original.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-zinc-500">All users across every restaurant</p>
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">
            {data?.users.length ?? 0} users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.users ?? []}
            loading={loading}
            searchKey="name"
            searchPlaceholder="Search users…"
            pageSize={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
