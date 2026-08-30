"use client";

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HealthStatus = "connected" | "degraded" | "unreachable" | "configured" | "not_configured";

function StatusDot({ status }: { status: HealthStatus }) {
  const map = {
    connected: "bg-emerald-400",
    configured: "bg-emerald-400",
    degraded: "bg-amber-400",
    unreachable: "bg-red-400",
    not_configured: "bg-zinc-500",
  };
  return <span className={cn("h-2 w-2 rounded-full", map[status])} />;
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "connected" || status === "configured") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }
  if (status === "degraded") return <AlertCircle className="h-4 w-4 text-amber-400" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
}

export type PlatformHealth = {
  database: { status: "connected" | "unreachable"; error?: string };
  voiceAi: { status: "connected" | "degraded" | "unreachable"; error?: string };
  gemini: { configured: boolean };
};

export function HealthPanel({ health, loading }: { health?: PlatformHealth; loading?: boolean }) {
  const items = [
    {
      name: "Database",
      status: (health?.database.status === "connected" ? "connected" : "unreachable") as HealthStatus,
      detail: health?.database.error ?? (health?.database.status === "connected" ? "MySQL connected" : "Unreachable"),
    },
    {
      name: "Voice AI API",
      status: (health?.voiceAi.status ?? "unreachable") as HealthStatus,
      detail: health?.voiceAi.error ?? health?.voiceAi.status ?? "Checking…",
    },
    {
      name: "Gemini API",
      status: (health?.gemini.configured ? "configured" : "not_configured") as HealthStatus,
      detail: health?.gemini.configured ? "API key configured" : "Not configured",
    },
  ];

  return (
    <Card className="border-white/[0.06] bg-[#111113]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white">System health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
            ))
          : items.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <StatusIcon status={item.status} />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.detail}</p>
                  </div>
                </div>
                <StatusDot status={item.status} />
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
