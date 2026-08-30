"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cherry-600 via-cherry-700 to-cherry-900 px-8 py-16 text-center shadow-glow sm:px-16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Ready to answer every call?
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Put Cherry on your phone line today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Upload your menu, deploy a voice agent, and start taking phone orders
              with kitchen sync and instant payments — free to start.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="xl"
                className="bg-white text-cherry-700 hover:bg-white/90 min-w-[200px]"
                asChild
              >
                <Link href="/onboarding">
                  Get started free
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="min-w-[200px] border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
