"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign,
  PhoneCall,
  Receipt,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { mapRevenueTrend } from "@/lib/mappers";
import { toMajor } from "@/lib/currency";
import { formatDuration, cn } from "@/lib/utils";

type Range = 7 | 30;

type ExtendedAnalytics = {
  currency?: string;
  overview: {
    ordersToday: number;
    revenueToday: number;
    ordersYesterday: number;
    revenueYesterday: number;
    callsToday: number;
    revenueTotal: number;
    ordersTotal: number;
  };
  trend: Array<Record<string, unknown>>;
  ordersByHour: Array<{ hour: number; orders: number }>;
  topMenuItems: Array<{ name: string; qty: number; revenue: number }>;
  callMetrics: {
    callsToday: number;
    avgDurationToday: number;
    callsWeek: number;
    avgDurationWeek: number;
  };
  paymentSuccess: { total: number; paid: number; rate: number };
  forecast?: {
    forecast: Array<{
      day: string;
      label: string;
      revenue: number;
      orders: number;
      projected: boolean;
    }>;
    avgRevenue: number;
  };
};

function pctDelta(today: number, yesterday: number): number | undefined {
  if (!yesterday) return undefined;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const { currency, formatMoney, formatMajor } = useCurrency();
  const { data, loading, error, retry } = useApiQuery<ExtendedAnalytics>(
    `/api/analytics?extended=1&days=${range}`,
  );

  const apiCurrency = data?.currency ?? currency;
  const revenueSeries = useMemo(
    () => mapRevenueTrend(data?.trend ?? [], apiCurrency),
    [data?.trend, apiCurrency],
  );

  const hourData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, "0")}:00`,
      orders: 0,
    }));
    for (const row of data?.ordersByHour ?? []) {
      const h = Number(row.hour);
      if (h >= 0 && h < 24) hours[h].orders = Number(row.orders);
    }
    return hours;
  }, [data?.ordersByHour]);

  const topItems = useMemo(
    () =>
      (data?.topMenuItems ?? []).map((item) => ({
        name: String(item.name),
        qty: Number(item.qty),
        revenue: toMajor(Number(item.revenue ?? 0), apiCurrency),
      })),
    [data?.topMenuItems, apiCurrency],
  );

  const forecastSeries = useMemo(() => {
    const rows = data?.forecast?.forecast ?? [];
    return rows.map((r) => ({
      label: r.label,
      revenue: toMajor(r.revenue, apiCurrency),
      projected: r.projected,
    }));
  }, [data?.forecast, apiCurrency]);

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Analytics" description="Insights across your business." />
        <ErrorState onRetry={retry} />
      </div>
    );
  }

  const overview = data?.overview;
  const ordersDelta = overview
    ? pctDelta(overview.ordersToday, overview.ordersYesterday)
    : undefined;
  const revenueDelta = overview
    ? pctDelta(overview.revenueToday, overview.revenueYesterday)
    : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Revenue, orders, calls, and menu performance — all from live data."
      >
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
              {d} days
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
        ) : (
          <>
            <KpiCard
              label="Revenue today"
              value={formatMoney(overview?.revenueToday ?? 0)}
              delta={revenueDelta}
              icon={DollarSign}
              accent="success"
              sub="vs. yesterday"
            />
            <KpiCard
              label="Orders today"
              value={String(overview?.ordersToday ?? 0)}
              delta={ordersDelta}
              icon={Receipt}
              accent="primary"
              sub="vs. yesterday"
            />
            <KpiCard
              label="Calls today"
              value={String(data?.callMetrics?.callsToday ?? 0)}
              icon={PhoneCall}
              accent="info"
              sub={`avg ${formatDuration(data?.callMetrics?.avgDurationToday ?? 0)}`}
            />
            <KpiCard
              label="Payment success"
              value={`${data?.paymentSuccess?.rate ?? 0}%`}
              icon={TrendingUp}
              accent="warning"
              sub={`${data?.paymentSuccess?.paid ?? 0}/${data?.paymentSuccess?.total ?? 0} last 30d`}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : revenueSeries.length === 0 ? (
                <p className="py-16 text-center text-sm font-medium text-muted-foreground">
                  No revenue data yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSeries}>
                    <defs>
                      <linearGradient id="analyticsRev" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-card">
                            <p className="font-medium text-muted-foreground">{label}</p>
                            <p className="font-bold">
                              {formatMajor(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      fill="url(#analyticsRev)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by hour</CardTitle>
            <p className="text-sm font-medium text-muted-foreground">
              Last 7 days · peak ordering times
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      interval={3}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tickLine={false} axisLine={false} width={32} />
                    <Tooltip />
                    <Bar
                      dataKey="orders"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue forecast</CardTitle>
          <p className="text-sm font-medium text-muted-foreground">
            Historical trend + 7-day projection from seasonality
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : forecastSeries.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Not enough data for forecasting yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const projected = payload[0].payload?.projected;
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-card">
                          <p className="font-medium text-muted-foreground">
                            {label} {projected ? "(forecast)" : ""}
                          </p>
                          <p className="font-bold">{formatMajor(payload[0].value as number)}</p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={props.index}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={payload.projected ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Top menu items
            </CardTitle>
            <p className="text-sm font-medium text-muted-foreground">Last 30 days</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : topItems.length === 0 ? (
              <p className="py-12 text-center text-sm font-medium text-muted-foreground">
                No menu sales yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {topItems.map((item, i) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="font-semibold">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-bold">{item.qty} sold</p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatMajor(item.revenue)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call volume</CardTitle>
            <p className="text-sm font-medium text-muted-foreground">
              Today vs. last 7 days
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Calls today
                    </p>
                    <p className="tabular mt-1 text-3xl font-bold">
                      {data?.callMetrics?.callsToday ?? 0}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      avg {formatDuration(data?.callMetrics?.avgDurationToday ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Last 7 days
                    </p>
                    <p className="tabular mt-1 text-3xl font-bold">
                      {data?.callMetrics?.callsWeek ?? 0}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      avg {formatDuration(data?.callMetrics?.avgDurationWeek ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Payment success rate</p>
                    <p className="tabular text-2xl font-bold text-success">
                      {data?.paymentSuccess?.rate ?? 0}%
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${data?.paymentSuccess?.rate ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {data?.paymentSuccess?.paid ?? 0} successful of{" "}
                    {data?.paymentSuccess?.total ?? 0} payments (30 days)
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
