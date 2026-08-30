"use client";

import { useEffect, useMemo, useState } from "react";
import { PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { mapCallRow } from "@/lib/mappers";
import { formatDuration } from "@/lib/utils";

type CallsResponse = {
  data: Array<Record<string, unknown>>;
};

export function LiveCalls() {
  const { data, loading } = useApiQuery<CallsResponse>("/api/calls?limit=10");
  const active = useMemo(
    () =>
      (data?.data ?? [])
        .filter((c) => ["initiated", "ringing", "in_progress"].includes(String(c.status)))
        .slice(0, 2)
        .map((c) => mapCallRow(c)),
    [data],
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          Live calls
        </CardTitle>
        <Badge variant="destructive">{active.length} active</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : active.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No active calls.</p>
        ) : (
          active.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border bg-accent/40 p-3"
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.customerName}</p>
                <p className="text-xs text-muted-foreground">
                  with {c.agentName} · {c.customerPhone}
                </p>
              </div>
              <span className="tabular text-sm font-semibold text-primary">
                {formatDuration(c.duration + (tick % 60))}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
