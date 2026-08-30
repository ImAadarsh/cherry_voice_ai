"use client";

import { DollarSign, PhoneCall, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrdersFunnelChart } from "@/components/dashboard/orders-funnel-chart";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { LiveCalls } from "@/components/dashboard/live-calls";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function pctDelta(today: number, yesterday: number): number | undefined {
  if (!yesterday) return undefined;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

type AnalyticsResponse = {
  overview: {
    ordersToday: number;
    revenueToday: number;
    ordersYesterday: number;
    revenueYesterday: number;
    activeCalls: number;
    callsToday: number;
    pendingPayments: number;
    pendingAmount: number;
  };
};

export default function DashboardPage() {
  const { user, restaurant, authenticated, loading: authLoading, onboardingCompleted } = useAuth();
  const { formatMoney } = useCurrency();
  const { data, loading, error, retry } = useApiQuery<AnalyticsResponse>(
    authenticated ? "/api/analytics" : null,
  );

  const overview = data?.overview;
  const ordersDelta = overview
    ? pctDelta(overview.ordersToday, overview.ordersYesterday)
    : undefined;
  const revenueDelta = overview
    ? pctDelta(overview.revenueToday, overview.revenueYesterday)
    : undefined;
  const conversionRate =
    overview && overview.callsToday > 0
      ? Math.round((overview.ordersToday / overview.callsToday) * 1000) / 10
      : overview?.ordersToday
        ? 100
        : 0;

  if (!authLoading && !authenticated) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Cherry Voice AI"
          description="Sign in to view live orders, calls, and revenue from your restaurant."
        />
        <ErrorState
          title="Sign in required"
          description="Connect to your MySQL-backed dashboard to see real-time data for your restaurant."
          onRetry={() => (window.location.href = "/login")}
        />
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/onboarding">Get started</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" description="Could not load analytics." />
        <ErrorState
          title="Failed to load dashboard"
          description="We couldn't reach the API. Check your connection and try again."
          onRetry={retry}
        />
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          restaurant?.name
            ? `Live data for ${restaurant.name} — synced from MySQL.`
            : "Here's what's happening at your restaurant today."
        }
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/analytics">View analytics</Link>
        </Button>
        {!onboardingCompleted && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/onboarding">Setup</Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading || authLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))
        ) : (
          <>
            <KpiCard
              index={0}
              label="Revenue today"
              value={formatMoney(overview?.revenueToday ?? 0)}
              delta={revenueDelta}
              icon={DollarSign}
              accent="success"
              sub="vs. yesterday"
            />
            <KpiCard
              index={1}
              label="Orders today"
              value={String(overview?.ordersToday ?? 0)}
              delta={ordersDelta}
              icon={Receipt}
              accent="primary"
              sub="vs. yesterday"
            />
            <KpiCard
              index={2}
              label="Active calls"
              value={String(overview?.activeCalls ?? 0)}
              icon={PhoneCall}
              accent="info"
              sub="live now"
            />
            <KpiCard
              index={3}
              label="Conversion rate"
              value={`${conversionRate}%`}
              icon={TrendingUp}
              accent="warning"
              sub="orders per call today"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <LiveCalls />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <RecentOrders />
          <ActivityFeed limit={6} />
        </div>
        <div className="space-y-6">
          <OrdersFunnelChart />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
