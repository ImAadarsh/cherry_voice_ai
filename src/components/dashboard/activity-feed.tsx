"use client";

import Link from "next/link";
import {
  PhoneCall,
  Receipt,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { formatRelativeTime } from "@/lib/utils";
import { toMajor } from "@/lib/currency";

type TimelineItem = {
  type: "call" | "order" | "payment";
  id: string;
  entityId: unknown;
  at: string;
  title: string;
  subtitle?: string;
  status: string;
  meta?: Record<string, unknown>;
};

const iconMap = {
  call: PhoneCall,
  order: Receipt,
  payment: CreditCard,
};

export function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const { formatMajor } = useCurrency();
  const { data, loading } = useApiQuery<{ timeline: TimelineItem[] }>(
    `/api/insights?limit=${limit}`,
  );

  const timeline = (data?.timeline ?? []).slice(0, limit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent activity</CardTitle>
          <p className="text-sm text-muted-foreground">Calls, orders & payments</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/insights">
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="divide-y px-0 pb-0">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-6 py-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))
        ) : timeline.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No activity yet</p>
        ) : (
          timeline.map((item) => {
            const Icon = iconMap[item.type];
            return (
              <div key={item.id} className="flex items-start gap-3 px-6 py-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(item.at)}
                    {item.type === "order" && item.meta?.total != null && (
                      <> · {formatMajor(toMajor(Number(item.meta.total), String(item.meta.currency ?? "USD")))}</>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                  {item.type}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
