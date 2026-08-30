"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChefHat,
  CreditCard,
  PhoneCall,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LandingHero3D = dynamic(
  () => import("./landing-hero-3d").then((m) => m.LandingHero3D),
  { ssr: false },
);

const heroFeatures = [
  {
    icon: PhoneCall,
    title: "24/7 phone orders",
    desc: "Never miss a dinner rush call — AI answers every ring",
  },
  {
    icon: ChefHat,
    title: "Kitchen sync",
    desc: "Orders flow straight to your kitchen display in real time",
  },
  {
    icon: CreditCard,
    title: "Instant payments",
    desc: "Collect via Stripe or Razorpay before the caller hangs up",
  },
];

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-20">
      <LandingHero3D />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp} className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Built for restaurants
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            The AI phone line your restaurant{" "}
            <span className="text-gradient">never sleeps on</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
          >
            Cherry Voice AI answers every call, takes orders with your full menu,
            syncs tickets to the kitchen, and collects payment — while you focus
            on the dining room.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button size="xl" className="group min-w-[180px]" asChild>
              <Link href="/onboarding">
                Get started free
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="min-w-[180px] border-foreground/20 bg-foreground text-background hover:bg-foreground/90 hover:text-background dark:bg-foreground dark:text-background"
              asChild
            >
              <Link href="#demo">Try it live</Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="mt-16 grid gap-4 sm:grid-cols-3"
        >
          {heroFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className={cn(
                "group rounded-2xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur-sm transition-all",
                "hover:border-primary/25 hover:shadow-card",
              )}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
