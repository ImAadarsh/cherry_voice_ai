import Link from "next/link";
import { LogoIcon } from "@/components/brand/logo-icon";

const footerLinks = {
  Product: [
    { href: "#features", label: "Features" },
    { href: "#dashboard", label: "Dashboard" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  Company: [
    { href: "/onboarding", label: "Get started" },
    { href: "/login", label: "Sign in" },
    { href: "/dashboard", label: "Dashboard" },
  ],
  Resources: [
    { href: "#demo", label: "Voice demo" },
    { href: "/onboarding", label: "Menu upload" },
    { href: "/onboarding", label: "Agent setup" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoIcon className="h-8 w-8" />
              <span className="font-display font-bold">Cherry Voice AI</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              The AI phone line for restaurants. Phone orders, kitchen sync, and
              payments — powered by natural voice conversation.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 sm:flex-row">
          <p className="text-xs font-medium text-muted-foreground">
            © {new Date().getFullYear()} Cherry Voice AI. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs font-medium text-muted-foreground">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Status</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
