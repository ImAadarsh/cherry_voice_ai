"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  ChefHat,
  CreditCard,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import type { OrderStatus } from "@/types";

const revenueData = [
  { label: "Mon", revenue: 1240, orders: 18 },
  { label: "Tue", revenue: 980, orders: 14 },
  { label: "Wed", revenue: 1560, orders: 22 },
  { label: "Thu", revenue: 1320, orders: 19 },
  { label: "Fri", revenue: 2180, orders: 31 },
  { label: "Sat", revenue: 2840, orders: 42 },
  { label: "Sun", revenue: 2420, orders: 36 },
];

const recentOrders: Array<{
  id: string;
  customer: string;
  reference: string;
  items: number;
  total: string;
  status: OrderStatus;
  time: string;
}> = [
  {
    id: "1",
    customer: "Sarah Kim",
    reference: "ORD-1842",
    items: 3,
    total: "$28.50",
    status: "preparing",
    time: "2 min ago",
  },
  {
    id: "2",
    customer: "Mike Torres",
    reference: "ORD-1841",
    items: 2,
    total: "$19.00",
    status: "paid",
    time: "8 min ago",
  },
  {
    id: "3",
    customer: "Lisa Park",
    reference: "ORD-1840",
    items: 4,
    total: "$42.75",
    status: "ready",
    time: "14 min ago",
  },
  {
    id: "4",
    customer: "James Wu",
    reference: "ORD-1839",
    items: 1,
    total: "$12.50",
    status: "completed",
    time: "22 min ago",
  },
];

const liveCalls = [
  {
    id: "c1",
    customer: "Unknown caller",
    agent: "Cherry Bistro",
    phone: "+1 (555) 0142",
    duration: "01:47",
  },
  {
    id: "c2",
    customer: "Emma Rodriguez",
    agent: "Cherry Bistro",
    phone: "+1 (555) 0198",
    duration: "00:32",
  },
];

const activity = [
  { type: "order", title: "New order ORD-1842", sub: "2× Margherita + garlic bread", time: "2m" },
  { type: "call", title: "Call answered", sub: "Delivery order · 3:12 duration", time: "8m" },
  { type: "payment", title: "Payment received", sub: "$28.50 via Stripe link", time: "9m" },
  { type: "order", title: "Kitchen ticket fired", sub: "ORD-1841 · 2 items", time: "12m" },
];

const activityIcons = {
  order: Receipt,
  call: PhoneCall,
  payment: CreditCard,
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function LandingDashboardShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="dashboard" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Your command center
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Every call, order & payment — one dashboard
          </h2>
          <p className="mt-4 text-muted-foreground">
            Watch revenue climb, kitchen tickets fire, and live calls convert to paid orders —
            all synced in real time.
          </p>
        </div>

        <motion.div
          ref={ref}
          variants={container}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="mt-14 space-y-5"
        >
          <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Revenue today"
              value="$2,420"
              delta={18.4}
              icon={DollarSign}
              accent="success"
              sub="vs yesterday"
              index={0}
            />
            <KpiCard
              label="Orders today"
              value="36"
              delta={12.1}
              icon={Receipt}
              accent="primary"
              sub="6 from voice calls"
              index={1}
            />
            <KpiCard
              label="Active calls"
              value="2"
              icon={PhoneCall}
              accent="info"
              sub="Live right now"
              index={2}
            />
            <KpiCard
              label="Call conversion"
              value="68%"
              delta={5.2}
              icon={TrendingUp}
              accent="warning"
              sub="Calls → orders"
              index={3}
            />
          </motion.div>

          <motion.div variants={item} className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle>Revenue</CardTitle>
                  <p className="text-sm font-medium text-muted-foreground">
                    $12,540 · last 7 days
                  </p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <ChefHat className="h-3 w-3" /> Cherry Bistro
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={revenueData}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="landingRevFill" x1="0" y1="0" x2="0" y2="1">
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
                        width={48}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        cursor={{
                          stroke: "hsl(var(--primary))",
                          strokeWidth: 1,
                          strokeDasharray: "4 4",
                        }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-card">
                              <p className="text-xs font-medium text-muted-foreground">
                                {label}
                              </p>
                              <p className="font-bold">${payload[0].value}</p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        fill="url(#landingRevFill)"
                        dot={false}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          stroke: "hsl(var(--background))",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                  Live calls
                </CardTitle>
                <Badge variant="destructive">{liveCalls.length} active</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {liveCalls.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border bg-accent/40 p-3"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.customer}</p>
                      <p className="text-xs text-muted-foreground">
                        with {c.agent} · {c.phone}
                      </p>
                    </div>
                    <span className="tabular text-sm font-semibold text-primary">
                      {c.duration}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item} className="grid gap-5 lg:grid-cols-2">
            <Card className="h-full">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Recent orders</CardTitle>
                <Badge variant="outline">Voice + web</Badge>
              </CardHeader>
              <CardContent className="px-2">
                <ul className="divide-y">
                  {recentOrders.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-muted text-[11px]">
                          {o.customer
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{o.customer}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.reference} · {o.items} items · {o.time}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="tabular text-sm font-semibold">{o.total}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <p className="text-sm text-muted-foreground">Calls, orders & payments</p>
              </CardHeader>
              <CardContent className="divide-y px-0 pb-0">
                {activity.map((a, i) => {
                  const Icon = activityIcons[a.type as keyof typeof activityIcons];
                  return (
                    <div key={i} className="flex gap-3 px-6 py-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{a.time}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
