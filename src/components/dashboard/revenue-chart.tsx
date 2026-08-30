"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { mapRevenueTrend } from "@/lib/mappers";
import { formatMajor as formatMajorCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Metric = "revenue" | "orders";
type Range = 7 | 30;

type AnalyticsResponse = {
  trend: Array<Record<string, unknown>>;
  currency?: string;
};

export function RevenueChart() {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [range, setRange] = useState<Range>(7);
  const { currency } = useCurrency();
  const { data, loading } = useApiQuery<AnalyticsResponse>(
    `/api/analytics?days=${range}`,
  );
  const apiCurrency = data?.currency ?? currency;
  const revenueSeries = useMemo(
    () => mapRevenueTrend(data?.trend ?? [], apiCurrency),
    [data?.trend, apiCurrency],
  );
  const total = revenueSeries.reduce((s, d) => s + d[metric], 0);

  if (loading) {
    return <Skeleton className="h-[360px] w-full rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>Revenue</CardTitle>
          <p className="text-sm font-medium text-muted-foreground">
            {metric === "revenue"
              ? formatMajorCurrency(total, apiCurrency)
              : `${total} orders`}{" "}
            · last {range} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
            {([7, 30] as Range[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRange(d)}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  range === d
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
            {(["revenue", "orders"] as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 capitalize transition-colors",
                  metric === m
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          {revenueSeries.length === 0 ? (
            <p className="py-16 text-center text-sm font-medium text-muted-foreground">
              No data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueSeries}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fontSize: 12,
                    fill: "hsl(var(--muted-foreground))",
                    fontWeight: 500,
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fontSize: 12,
                    fill: "hsl(var(--muted-foreground))",
                    fontWeight: 500,
                  }}
                  width={56}
                  tickFormatter={(v) =>
                    metric === "revenue"
                      ? formatMajorCurrency(v as number, apiCurrency)
                      : `${v}`
                  }
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--primary))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const v = payload[0].value as number;
                    return (
                      <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-card">
                        <p className="text-xs font-medium text-muted-foreground">
                          {label}
                        </p>
                        <p className="font-bold">
                          {metric === "revenue"
                            ? formatMajorCurrency(v, apiCurrency)
                            : `${v} orders`}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#revFill)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: "hsl(var(--background))",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
