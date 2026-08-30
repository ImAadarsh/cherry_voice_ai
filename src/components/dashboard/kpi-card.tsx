"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  accent?: "primary" | "info" | "success" | "warning";
  sub?: string;
  index?: number;
}

const accentMap = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground dark:text-warning",
};

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent = "primary",
  sub,
  index = 0,
}: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
    >
      <Card className="group relative overflow-hidden p-5 transition-shadow hover:shadow-card">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl",
              accentMap[accent]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          {typeof delta === "number" && (
            <span
              className={cn(
                "flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold",
                positive
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="tabular font-display text-3xl font-bold tracking-tight">
            {value}
          </p>
          {sub && <p className="text-xs font-medium text-muted-foreground">{sub}</p>}
        </div>
      </Card>
    </motion.div>
  );
}
