"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Mic,
  Phone,
  User,
  Headphones,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const conversation = [
  {
    role: "agent" as const,
    text: "Hi, thanks for calling Cherry Bistro! Are you ordering for pickup or delivery tonight?",
  },
  {
    role: "caller" as const,
    text: "Delivery please. Can I get two margherita pizzas and a Caesar salad?",
  },
  {
    role: "agent" as const,
    text: "Two margheritas and a Caesar — got it. Want to add our garlic bread special for $4? It's fresh from the oven.",
  },
  { role: "caller" as const, text: "Yes, add one garlic bread. That's everything." },
  {
    role: "agent" as const,
    text: "Perfect! Your total is $38.50. I'll text a Stripe payment link now — your order hits the kitchen as soon as you pay.",
  },
];

function SoundBars({ active }: { active: boolean }) {
  return (
    <div className="flex h-5 items-end gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-primary"
          animate={
            active
              ? { height: [4, 12 + i * 2, 6, 14 - i, 4] }
              : { height: 4 }
          }
          transition={
            active
              ? { repeat: Infinity, duration: 0.8, delay: i * 0.1 }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}

export function LandingVoiceDemo() {
  const [visible, setVisible] = useState(0);
  const [tab, setTab] = useState<"preview" | "live">("preview");
  const isTyping = visible < conversation.length && visible > 0;

  useEffect(() => {
    if (tab !== "preview" || visible >= conversation.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 2400);
    return () => clearTimeout(t);
  }, [visible, tab]);

  useEffect(() => {
    if (tab === "preview") {
      setVisible(0);
      const t = setTimeout(() => setVisible(1), 600);
      return () => clearTimeout(t);
    }
  }, [tab]);

  return (
    <section id="demo" className="bg-muted/20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Voice demo
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Hear Cherry Bistro take a real order
            </h2>
            <p className="mt-4 text-muted-foreground">
              Watch a dinner-rush call unfold — modifiers, upsells, and payment
              collection handled naturally. Then try a live browser call after
              signing up.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="outline">Menu modifiers</Badge>
              <Badge variant="outline">Upsell specials</Badge>
              <Badge variant="outline">Kitchen tickets</Badge>
              <Badge variant="outline">Stripe payment links</Badge>
            </div>
            <Button size="lg" className="mt-8 gap-2 group" asChild>
              <Link href="/onboarding">
                <Headphones className="h-4 w-4" />
                Try it live — free
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Live browser demo available after onboarding
            </p>
          </div>

          <div className="relative">
            <div className="mb-3 flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 transition-colors",
                  tab === "preview"
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Watch demo
              </button>
              <button
                type="button"
                onClick={() => setTab("live")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 transition-colors",
                  tab === "live"
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Try live
              </button>
            </div>

            {tab === "preview" ? (
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-teal-500/5" />
                <div className="relative p-6">
                  <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Phone className="h-5 w-5 text-primary" />
                      <motion.span
                        className="absolute inset-0 rounded-full border-2 border-primary/30"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Cherry Bistro Agent</p>
                      <div className="flex items-center gap-2">
                        <SoundBars active={isTyping || visible < conversation.length} />
                        <p className="text-xs font-medium text-muted-foreground">
                          {visible >= conversation.length ? "Call ended" : "Active call"} · 02:47
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-teal-600 hover:bg-teal-600">
                      {visible >= conversation.length ? "Paid" : "Live"}
                    </Badge>
                  </div>

                  <div className="mt-4 min-h-[300px] space-y-3">
                    <AnimatePresence>
                      {conversation.slice(0, visible).map((line, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: line.role === "agent" ? -16 : 16, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 24 }}
                          className={cn(
                            "flex gap-2",
                            line.role === "caller" ? "justify-end" : "",
                          )}
                        >
                          {line.role === "agent" && (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <Mic className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}
                          <p
                            className={cn(
                              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                              line.role === "agent"
                                ? "bg-muted text-foreground"
                                : "bg-primary text-primary-foreground",
                            )}
                          >
                            {line.text}
                          </p>
                          {line.role === "caller" && (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                              <User className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isTyping && visible < conversation.length && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-2"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Mic className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {visible >= conversation.length && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm"
                      >
                        <Sparkles className="h-4 w-4 text-teal-600" />
                        <span>
                          Payment link sent · Order <strong>ORD-1842</strong> fired to kitchen
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Headphones className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold">
                  Talk to Cherry Bistro live
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                  Start a free account to launch a browser voice demo — no phone number required. Order a pizza for real.
                </p>
                <Button size="lg" className="mt-8 gap-2 group" asChild>
                  <Link href="/onboarding">
                    Start free — try live call
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">
                  Available after you complete onboarding
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
