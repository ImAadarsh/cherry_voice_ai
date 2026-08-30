"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;

export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPull(Math.min(delta * 0.5, 90));
  };

  const onTouchEnd = async () => {
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPull(0);
    startY.current = null;
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn("relative", className)}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{ height: pull, opacity: pull / THRESHOLD }}
      >
        <div className="mt-2 grid h-8 w-8 place-items-center rounded-full bg-card shadow-soft">
          <RefreshCw
            className={cn(
              "h-4 w-4 text-primary",
              refreshing && "animate-spin"
            )}
            style={{ transform: `rotate(${pull * 3}deg)` }}
          />
        </div>
      </div>
      <motion.div animate={{ y: pull }} transition={{ type: "spring", stiffness: 400, damping: 40 }}>
        {children}
      </motion.div>
    </div>
  );
}
