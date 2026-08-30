"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleStyles: Record<string, string> = {
  super_admin: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  platform_admin: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  owner: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  admin: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  manager: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  staff: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
  viewer: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

export function RoleBadge({ role }: { role: string }) {
  const label = role.replace(/_/g, " ");
  return (
    <Badge
      variant="outline"
      className={cn("capitalize border font-medium", roleStyles[role] ?? roleStyles.staff)}
    >
      {label}
    </Badge>
  );
}
