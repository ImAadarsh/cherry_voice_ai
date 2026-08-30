"use client";

import { motion } from "framer-motion";
import { Building2, HeartPulse, Scissors, Home } from "lucide-react";

const others = [
  { icon: Scissors, label: "Salons" },
  { icon: HeartPulse, label: "Clinics" },
  { icon: Home, label: "Real estate" },
  { icon: Building2, label: "Services" },
];

export function LandingBeyondRestaurants() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="border-y border-border/40 bg-muted/20 py-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:gap-8 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-muted-foreground sm:text-left">
          Built for restaurants first — also works for{" "}
          <span className="font-medium text-foreground">salons, clinics & more</span>
        </p>
        <div className="flex items-center gap-5">
          {others.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 text-muted-foreground"
              title={label}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/80">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
