"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    quote:
      "We went from missing 30% of dinner rush calls to capturing every order. Revenue up 22% in the first month.",
    author: "Maria Chen",
    role: "Owner, Cherry Bistro",
    avatar: "MC",
  },
  {
    quote:
      "Friday night used to mean a phone ringing off the hook. Now Cherry handles orders while my team plates food.",
    author: "James Okonkwo",
    role: "GM, Harbor Kitchen",
    avatar: "JO",
  },
  {
    quote:
      "Setup took an afternoon. The AI understood our menu from a PDF and our agent sounded natural by day two.",
    author: "Priya Sharma",
    role: "Ops Lead, Spice Route Kitchen",
    avatar: "PS",
  },
];

export function LandingTestimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Testimonials
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Restaurant owners who stopped missing calls
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
            >
              <p className="leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
