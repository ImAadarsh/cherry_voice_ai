"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(var(--warning))",
  paid: "hsl(var(--info))",
  preparing: "hsl(var(--chart-3))",
  completed: "hsl(var(--success))",
  cancelled: "hsl(var(--destructive))",
  draft: "hsl(var(--muted-foreground))",
  confirmed: "hsl(var(--info))",
  ready: "hsl(var(--chart-4))",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  preparing: "Preparing",
  completed: "Completed",
  cancelled: "Cancelled",
  draft: "Draft",
  confirmed: "Confirmed",
  ready: "Ready",
};

type AnalyticsResponse = {
  overview: {
    ordersByStatus: Array<{ status: string; count: number }>;
  };
};

export function OrdersFunnelChart() {
  const { data, loading } = useApiQuery<AnalyticsResponse>("/api/analytics");

  const chartData = useMemo(() => {
    const rows = data?.overview?.ordersByStatus ?? [];
    return rows
      .map((r) => ({
        name: STATUS_LABELS[String(r.status)] ?? String(r.status),
        value: Number(r.count),
        status: String(r.status),
      }))
      .filter((d) => d.value > 0);
  }, [data]);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return <Skeleton className="h-[320px] w-full rounded-xl" />;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Order status</CardTitle>
        <p className="text-sm font-medium text-muted-foreground">
          {total} total orders · breakdown by status
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-16 text-center text-sm font-medium text-muted-foreground">
            No orders yet.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-[200px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={
                          STATUS_COLORS[entry.status] ??
                          "hsl(var(--primary))"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as (typeof chartData)[0];
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-card">
                          <p className="font-semibold">{item.name}</p>
                          <p className="font-medium text-muted-foreground">
                            {item.value} orders (
                            {total > 0
                              ? Math.round((item.value / total) * 100)
                              : 0}
                            %)
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-2 sm:w-1/2">
              {chartData.map((d) => (
                <li
                  key={d.status}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          STATUS_COLORS[d.status] ?? "hsl(var(--primary))",
                      }}
                    />
                    <span className="text-sm font-semibold">{d.name}</span>
                  </div>
                  <span className="tabular text-sm font-bold">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
