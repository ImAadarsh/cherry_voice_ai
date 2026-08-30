"use client";

import Link from "next/link";
import {
  PhoneCall,
  Receipt,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
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

export default function InsightsPage() {
  const { formatMajor } = useCurrency();
  const { data, loading, error, retry } = useApiQuery<{ timeline: TimelineItem[] }>(
    "/api/insights?limit=50",
  );

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Activity" description="Call → order → payment timeline." />
        <ErrorState onRetry={retry} />
      </div>
    );
  }

  const timeline = data?.timeline ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity timeline"
        description="Unified feed: voice calls, orders, and payments in one view."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </PageHeader>

      <Card className="divide-y">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))
        ) : timeline.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            No activity yet. Calls and orders will appear here.
          </p>
        ) : (
          timeline.map((item) => {
            const Icon = iconMap[item.type];
            const href =
              item.type === "order"
                ? `/orders?focus=${item.entityId}`
                : item.type === "payment" && item.meta?.orderId
                  ? `/orders?focus=${item.meta.orderId}`
                  : undefined;

            return (
              <div key={item.id} className="flex items-start gap-4 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {item.type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.status}
                    </Badge>
                  </div>
                  {item.subtitle && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.subtitle}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(item.at)}
                    {item.type === "payment" && item.meta?.amount != null && (
                      <> · {formatMajor(toMajor(Number(item.meta.amount), String(item.meta.currency ?? "USD")))}</>
                    )}
                    {item.type === "order" && item.meta?.total != null && (
                      <> · {formatMajor(toMajor(Number(item.meta.total), String(item.meta.currency ?? "USD")))}</>
                    )}
                  </p>
                </div>
                {href && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={href}>
                      View <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
