"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { mapOrderRow } from "@/lib/mappers";
import { formatRelativeTime, initials } from "@/lib/utils";
import type { Order } from "@/types";
import { useMemo } from "react";

type OrdersResponse = {
  data: Array<Record<string, unknown> & { items?: Array<Record<string, unknown>> }>;
};

export function RecentOrders() {
  const { formatMajor } = useCurrency();
  const { data, loading } = useApiQuery<OrdersResponse>("/api/orders?limit=10");
  const recent = useMemo(
    () => (data?.data ?? []).map((row) => mapOrderRow(row, row.items ?? [])) as Order[],
    [data],
  );

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent orders</CardTitle>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/orders">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-2">
        {loading ? (
          <div className="space-y-2 px-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="divide-y">
            {recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders?focus=${o.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/60"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-muted text-[11px]">
                      {initials(o.customerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {o.customerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.reference} ·{" "}
                      {o.items.reduce((s, i) => s + i.qty, 0) || "—"} items ·{" "}
                      {formatRelativeTime(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular text-sm font-semibold">
                      {formatMajor(o.total)}
                    </span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
