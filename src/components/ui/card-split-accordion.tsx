"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type AccordionItem = {
  id: string | number;
  title: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
};

export function CardSplitAccordion({
  items,
  className,
  defaultId,
}: {
  items: AccordionItem[];
  className?: string;
  defaultId?: string | number;
}) {
  const [activeId, setActiveId] = useState<string | number>(
    defaultId ?? items[0]?.id,
  );
  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div
      className={cn(
        "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-6",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                isActive
                  ? "border-primary/30 bg-primary/5 shadow-soft"
                  : "border-border/60 bg-card/50 hover:border-primary/20 hover:bg-accent/40",
              )}
              whileTap={{ scale: 0.98 }}
            >
              {isActive && (
                <motion.span
                  layoutId="accordion-active"
                  className="absolute inset-0 rounded-xl bg-primary/5 ring-1 ring-primary/15"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              {item.icon && (
                <span
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {item.icon}
                </span>
              )}
              <span
                className={cn(
                  "relative z-10 font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.title}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={active?.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="p-6 sm:p-8"
          >
            {active?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
