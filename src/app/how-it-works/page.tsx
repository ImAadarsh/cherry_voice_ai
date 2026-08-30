"use client";

import { LandingNav } from "@/components/landing/landing-nav";
import { LandingArchitecture } from "@/components/landing/landing-architecture";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function HowItWorksPage() {
  return (
    <div className="min-h-svh bg-background">
      <LandingNav />
      <main className="pt-20 pb-16 sm:pt-24">
        <LandingArchitecture embedded />
      </main>
      <LandingFooter />
    </div>
  );
}
