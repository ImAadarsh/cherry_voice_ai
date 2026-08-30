"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PhoneOutgoing,
  Plus,
  Link2,
  UtensilsCrossed,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Action {
  label: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
  onClick: () => void;
}

export function QuickActions() {
  const router = useRouter();

  const actions: Action[] = [
    {
      label: "Demo call",
      desc: "Try your agent in browser",
      icon: Headphones,
      accent: "bg-primary/10 text-primary",
      onClick: () => router.push("/demo"),
    },
    {
      label: "Dispatch call",
      desc: "Outbound to a customer",
      icon: PhoneOutgoing,
      accent: "bg-info/10 text-info",
      onClick: () => router.push("/agents"),
    },
    {
      label: "New order",
      desc: "Manual entry",
      icon: Plus,
      accent: "bg-success/10 text-success",
      onClick: () => router.push("/orders?new=1"),
    },
    {
      label: "Payment link",
      desc: "Send to customer",
      icon: Link2,
      accent: "bg-success/10 text-success",
      onClick: () =>
        toast.success("Payment link sent", {
          description: "Stripe checkout link delivered via SMS.",
        }),
    },
    {
      label: "86 an item",
      desc: "Mark unavailable",
      icon: UtensilsCrossed,
      accent: "bg-warning/15 text-warning-foreground dark:text-warning",
      onClick: () => router.push("/menu"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className="group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/30 hover:shadow-soft active:scale-[0.98]"
            >
              <span
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-lg",
                  a.accent
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{a.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {a.desc}
                </span>
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
