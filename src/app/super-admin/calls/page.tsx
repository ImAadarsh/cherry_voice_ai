"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatDuration } from "@/lib/utils";

type CallRow = {
  id: number;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  status: string;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
  restaurant_id: number;
  restaurant_name: string;
  agent_name: string | null;
  created_at: string;
};

export default function SuperAdminCallsPage() {
  const [transcript, setTranscript] = useState<{ title: string; text: string } | null>(null);
  const { data, loading, error, retry } = useApiQuery<{ calls: CallRow[] }>(
    "/api/super-admin/calls",
  );

  const columns: ColumnDef<CallRow>[] = [
    {
      accessorKey: "restaurant_name",
      header: "Restaurant",
    },
    {
      accessorKey: "agent_name",
      header: "Agent",
      cell: ({ row }) => row.original.agent_name ?? "—",
    },
    {
      id: "numbers",
      header: "From → To",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.from_number ?? "?"} → {row.original.to_number ?? "?"}
        </span>
      ),
    },
    {
      accessorKey: "duration_seconds",
      header: "Duration",
      cell: ({ row }) =>
        row.original.duration_seconds != null
          ? formatDuration(row.original.duration_seconds)
          : "—",
    },
    {
      accessorKey: "status",
      header: "Outcome",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "completed" ? "success" : "secondary"}
          className="capitalize"
        >
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
    {
      id: "transcript",
      header: "",
      cell: ({ row }) =>
        row.original.transcript || row.original.summary ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setTranscript({
                title: `Call #${row.original.id} — ${row.original.restaurant_name}`,
                text: row.original.transcript || row.original.summary || "",
              });
            }}
          >
            <FileText className="h-3.5 w-3.5" /> Transcript
          </Button>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        ),
    },
  ];

  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Calls</h1>
        <p className="text-sm text-zinc-500">Voice call logs across all restaurants</p>
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">
            {data?.calls.length ?? 0} calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.calls ?? []}
            loading={loading}
            searchKey="restaurant_name"
            searchPlaceholder="Search restaurant…"
            pageSize={20}
          />
        </CardContent>
      </Card>

      <Dialog open={!!transcript} onOpenChange={() => setTranscript(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{transcript?.title}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
            {transcript?.text}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
