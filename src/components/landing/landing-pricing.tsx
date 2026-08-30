"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Perfect for a single-location restaurant getting started with voice ordering.",
    features: [
      "1 voice agent",
      "500 minutes/month",
      "Menu AI extraction",
      "Stripe & Razorpay",
      "Call history",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$149",
    period: "/month",
    description: "For busy restaurants scaling dinner rush and weekend call volume.",
    features: [
      "3 voice agents",
      "2,000 minutes/month",
      "Live call monitoring",
      "Multi-gateway payments",
      "Analytics dashboard",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Multi-location, custom integrations, and dedicated onboarding.",
    features: [
      "Unlimited agents",
      "Custom minute pools",
      "API access",
      "SLA & dedicated CSM",
      "White-label options",
      "Custom workflows",
    ],
    highlighted: false,
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Plans that grow with your restaurant
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free during onboarding. Upgrade when Friday night calls start stacking up.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl border p-6 shadow-soft ${
                plan.highlighted
                  ? "border-primary/40 bg-card ring-1 ring-primary/20 shadow-glow"
                  : "border-border/60 bg-card"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-lg font-bold">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {plan.description}
              </p>
              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-teal-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                asChild
              >
                <Link href="/onboarding">
                  {plan.name === "Enterprise" ? "Contact sales" : "Start free trial"}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
