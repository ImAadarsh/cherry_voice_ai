"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is Cherry Voice AI only for restaurants?",
    a: "No — while we excel at restaurant phone ordering, the platform adapts to salons, clinics, real estate, e-commerce, and professional services. Business type templates customize agent prompts, catalog fields, and dashboard labels automatically.",
  },
  {
    q: "How quickly can I go live?",
    a: "Most businesses complete onboarding in under an hour: add your catalog, connect a phone number, and deploy your first voice agent. AI menu extraction from PDFs speeds up setup significantly.",
  },
  {
    q: "What payment gateways are supported?",
    a: "Stripe and Razorpay are built in. Agents can send payment links during calls, and all transactions sync to your dashboard with webhook verification.",
  },
  {
    q: "Can I monitor live calls?",
    a: "Yes. The dashboard shows active calls in real time, with full call history, transcripts, and linked orders for every conversation.",
  },
  {
    q: "Do I need developers to customize the agent?",
    a: "No engineering required for standard setup. Configure personality, business hours, and catalog through the UI. Enterprise plans include API access for deeper integrations.",
  },
  {
    q: "What happens to my data?",
    a: "Data is stored in your MySQL database. Session-based auth protects your dashboard, and webhook signatures verify payment events.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="font-medium">{q}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-muted-foreground leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingFaq() {
  return (
    <section id="faq" className="py-20 sm:py-28 bg-muted/20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Common questions
          </h2>
        </div>

        <div className="mt-12 rounded-2xl border border-border/60 bg-card px-6 shadow-soft">
          {faqs.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
