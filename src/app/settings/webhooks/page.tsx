"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatRelativeTime } from "@/lib/utils";

type WebhookRow = {
  id: number;
  source: string;
  event_type: string | null;
  status: string;
  external_event_id: string | null;
  related_order_id: number | null;
  error_message: string | null;
  created_at: string;
};

export default function WebhooksSettingsPage() {
  const { data, loading, error, retry } = useApiQuery<{ data: WebhookRow[] }>(
    "/api/settings/webhooks?limit=100",
  );

  const rows = data?.data ?? [];

  const columns: ColumnDef<WebhookRow>[] = [
    {
      accessorKey: "created_at",
      header: "Received",
      cell: ({ row }) => (
        <span className="text-sm">{formatRelativeTime(String(row.original.created_at))}</span>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => <Badge variant="outline">{row.original.source}</Badge>,
    },
    {
      accessorKey: "event_type",
      header: "Event",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.event_type ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "processed"
              ? "success"
              : row.original.status === "failed"
                ? "destructive"
                : "secondary"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "related_order_id",
      header: "Order",
      cell: ({ row }) =>
        row.original.related_order_id ? (
          <Link
            href={`/orders?focus=${row.original.related_order_id}`}
            className="text-primary hover:underline"
          >
            #{row.original.related_order_id}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "error_message",
      header: "Error",
      cell: ({ row }) => (
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {row.original.error_message ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook logs"
        description="Inbound events from Omnidim and payment gateways — audit and debug."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings/general">Back to settings</Link>
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState onRetry={retry} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchKey="event_type"
          searchPlaceholder="Filter by event…"
          emptyTitle="No webhooks logged"
          emptyDescription="Webhook events appear here when Omnidim or payment providers POST to your endpoints."
          pageSize={15}
        />
      )}
    </div>
  );
}
