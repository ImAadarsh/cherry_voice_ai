"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  CreditCard,
  Megaphone,
  PhoneCall,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: UtensilsCrossed,
    title: "Menu AI",
    description:
      "Upload your menu PDF or photo. Cherry structures categories, modifiers, and prices — ready for voice ordering in minutes.",
    className: "sm:col-span-2 lg:row-span-2",
    large: true,
  },
  {
    icon: PhoneCall,
    title: "24/7 phone orders",
    description:
      "Natural voice agents handle complex orders, dietary questions, and upsells — even during your busiest rush.",
    className: "",
  },
  {
    icon: ChefHat,
    title: "Kitchen sync",
    description:
      "Every phone order fires a kitchen ticket instantly. Track prep status from call to pickup.",
    className: "",
  },
  {
    icon: CreditCard,
    title: "Payments",
    description:
      "Stripe, Razorpay, and customer tracking links with pay-now and invoice download.",
    className: "",
  },
  {
    icon: CalendarDays,
    title: "Reservations",
    description:
      "Book tables over the phone and send guests a live reservation status page.",
    className: "",
  },
  {
    icon: Megaphone,
    title: "Campaigns",
    description:
      "Promote tonight's special or happy hour with outbound voice campaigns to your regulars.",
    className: "",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "Revenue charts, call conversion, and order trends — see what's working every shift.",
    className: "sm:col-span-2",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Restaurant platform
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything your front-of-house needs — on autopilot
          </h2>
          <p className="mt-4 text-muted-foreground">
            From menu upload to payment collection, Cherry handles the phone line
            so your team handles the guests.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition-all hover:border-primary/20 hover:shadow-card",
                feature.className,
                feature.large && "flex flex-col justify-between p-6 sm:p-8",
              )}
            >
              <div>
                <div
                  className={cn(
                    "flex items-center justify-center rounded-xl bg-primary/10 text-primary",
                    feature.large ? "h-12 w-12" : "h-10 w-10",
                  )}
                >
                  <feature.icon className={feature.large ? "h-6 w-6" : "h-5 w-5"} />
                </div>
                <h3 className={cn("mt-4 font-semibold", feature.large && "text-xl")}>
                  {feature.title}
                </h3>
                <p
                  className={cn(
                    "mt-2 text-sm text-muted-foreground",
                    feature.large && "text-base leading-relaxed",
                  )}
                >
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
