"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Bot,
  DollarSign,
  PhoneCall,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/shared/states";
import { HealthPanel } from "@/components/super-admin/health-panel";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatCompact, formatRelativeTime } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

type OverviewData = {
  kpis: {
    restaurants: number;
    activeAgents: number;
    callsToday: number;
    ordersToday: number;
    revenueToday: number;
    revenueTotal: number;
    mrr: number | null;
  };
  charts: {
    signups: Array<{ day: string; count: number }>;
    callsVolume: Array<{ day: string; calls: number }>;
    ordersByRestaurant: Array<{ name: string; orders: number; revenue: number }>;
  };
  activity: Array<{
    type: string;
    ref_id: number;
    restaurant_name: string;
    summary: string;
    created_at: string;
  }>;
  health: {
    database: { status: "connected" | "unreachable"; error?: string };
    voiceAi: { status: "connected" | "degraded" | "unreachable"; error?: string };
    gemini: { configured: boolean };
  };
};

const chartTooltipStyle = {
  contentStyle: {
    background: "#18181b",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#a1a1aa" },
};

export default function SuperAdminOverviewPage() {
  const { data, loading, error, retry } = useApiQuery<OverviewData>("/api/super-admin/overview");

  if (error) {
    return <ErrorState onRetry={retry} />;
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Platform overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time metrics across all restaurants and voice agents.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />
          ))
        ) : (
          <>
            <KpiCard label="Restaurants" value={String(kpis?.restaurants ?? 0)} icon={Building2} accent="primary" index={0} />
            <KpiCard label="Active agents" value={String(kpis?.activeAgents ?? 0)} icon={Bot} accent="info" index={1} />
            <KpiCard label="Calls today" value={String(kpis?.callsToday ?? 0)} icon={PhoneCall} accent="warning" index={2} />
            <KpiCard label="Orders today" value={String(kpis?.ordersToday ?? 0)} icon={Receipt} accent="success" index={3} />
            <KpiCard
              label="Revenue today"
              value={formatCurrency((kpis?.revenueToday ?? 0) / 100)}
              icon={DollarSign}
              accent="primary"
              index={4}
            />
            <KpiCard
              label="MRR"
              value={kpis?.mrr != null ? formatCurrency(kpis.mrr / 100) : "—"}
              sub="Placeholder"
              icon={TrendingUp}
              accent="info"
              index={5}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/[0.06] bg-[#111113]">
          <CardHeader>
            <CardTitle className="text-base text-white">Signups (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {loading ? (
              <div className="h-full animate-pulse rounded-lg bg-white/[0.04]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts.signups ?? []}>
                  <defs>
                    <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="hsl(0 72% 51%)" fill="url(#signupGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-[#111113]">
          <CardHeader>
            <CardTitle className="text-base text-white">Call volume (14 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {loading ? (
              <div className="h-full animate-pulse rounded-lg bg-white/[0.04]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts.callsVolume ?? []}>
                  <defs>
                    <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} />
                  <Area type="monotone" dataKey="calls" stroke="#60a5fa" fill="url(#callsGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-white/[0.06] bg-[#111113] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-white">Orders by restaurant (top 10)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <div className="h-full animate-pulse rounded-lg bg-white/[0.04]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.ordersByRestaurant ?? []} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <Tooltip {...chartTooltipStyle} formatter={(v) => [formatCompact(Number(v ?? 0)), "Orders"]} />
                  <Bar dataKey="orders" fill="hsl(0 72% 51%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <HealthPanel health={data?.health} loading={loading} />
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-white/[0.04] px-0">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mx-6 h-12 animate-pulse rounded bg-white/[0.04]" />
            ))
          ) : (data?.activity ?? []).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zinc-500">No recent activity</p>
          ) : (
            (data?.activity ?? []).map((item) => (
              <div key={`${item.type}-${item.ref_id}`} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">{item.summary}</p>
                  <p className="text-xs text-zinc-500">
                    {item.restaurant_name} · {formatRelativeTime(item.created_at)}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 border-white/10 text-zinc-400 capitalize">
                  {item.type}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
