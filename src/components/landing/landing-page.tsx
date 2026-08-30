import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingLogoCloud } from "@/components/landing/landing-logo-cloud";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingArchitecture } from "@/components/landing/landing-architecture";
import { LandingDashboardShowcase } from "@/components/landing/landing-dashboard-showcase";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingVoiceDemo } from "@/components/landing/landing-voice-demo";
import { LandingBeyondRestaurants } from "@/components/landing/landing-beyond-restaurants";
import { LandingContact } from "@/components/landing/landing-contact";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingLogoCloud />
        <LandingHowItWorks />
        <LandingArchitecture />
        <LandingDashboardShowcase />
        <LandingFeatures />
        <LandingVoiceDemo />
        <LandingBeyondRestaurants />
        <LandingContact />
        <LandingTestimonials />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
