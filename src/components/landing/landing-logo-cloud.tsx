"use client";

import { motion } from "framer-motion";

const brands = [
  "Cherry Bistro",
  "Urban Eats",
  "La Piazza",
  "Green Bowl Co",
  "Night Owl Diner",
  "Coastal Grill",
  "Spice Route",
  "Farm Table",
];

export function LandingLogoCloud() {
  return (
    <section className="border-y border-border/50 bg-muted/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trusted by forward-thinking restaurants & service brands
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {brands.map((brand, i) => (
            <motion.span
              key={brand}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="font-display text-sm font-semibold text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {brand}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
