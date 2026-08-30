"use client";

import { motion } from "framer-motion";
import { CalendarCheck, Link2, Receipt, Smartphone } from "lucide-react";

const highlights = [
  {
    icon: Link2,
    title: "Customer order tracking link",
    description:
      "Every voice order gets a private link with live status, itemized totals, and secure pay-now — plus a downloadable invoice after payment.",
  },
  {
    icon: CalendarCheck,
    title: "Reservation status page",
    description:
      "Table bookings include a shareable page so guests see pending, confirmed, seated, or cancelled status in real time.",
  },
  {
    icon: Receipt,
    title: "Payment + invoice in one place",
    description:
      "Stripe and Razorpay checkout from the customer page. No app download — just tap the SMS link and pay.",
  },
  {
    icon: Smartphone,
    title: "Mobile-friendly updates",
    description:
      "Customers can fix a delivery address on the order page; your team gets notified instantly.",
  },
];

export function LandingCustomerExperience() {
  return (
    <section id="customer-experience" className="border-y border-border/60 bg-muted/20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Customer-facing
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Shareable links for orders and reservations
          </h2>
          <p className="mt-4 text-muted-foreground">
            Cherry sends customers a branded tracking page — not a generic payment URL — so they
            always know what they ordered, what they owe, and when it is ready.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {highlights.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
