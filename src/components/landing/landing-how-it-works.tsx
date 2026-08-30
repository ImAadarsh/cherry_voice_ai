"use client";

import { motion } from "framer-motion";
import {
  Bot,
  CreditCard,
  PhoneForwarded,
  Upload,
} from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload your menu",
    description:
      "Drop in your menu PDF or snap a photo. Cherry extracts items, prices, and modifiers automatically.",
  },
  {
    step: "02",
    icon: Bot,
    title: "Deploy your agent",
    description:
      "Connect your phone number and launch a voice agent trained on your menu, hours, and brand voice.",
  },
  {
    step: "03",
    icon: PhoneForwarded,
    title: "First phone order",
    description:
      "A caller orders two margheritas and garlic bread. The kitchen ticket fires before they hang up.",
  },
  {
    step: "04",
    icon: CreditCard,
    title: "Payment collected",
    description:
      "Cherry sends a payment link, confirms the order, and logs everything to your dashboard.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            From menu upload to paid order in under an hour
          </h2>
          <p className="mt-4 text-muted-foreground">
            No engineering team. No call center. Just your menu and a phone line
            that never goes to voicemail.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
              className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
            >
              <span className="text-xs font-bold text-primary">{item.step}</span>
              <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
