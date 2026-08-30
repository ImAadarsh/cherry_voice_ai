"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = navItems.filter((i) => i.mobile);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-1 py-2.5"
            >
              {active && (
                <motion.span
                  layoutId="bottom-active"
                  className="absolute -top-px h-0.5 w-8 rounded-full bg-primary"
                />
              )}
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={onMore}
          className="flex flex-col items-center gap-1 py-2.5 text-muted-foreground"
        >
          <MoreHorizontal className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
