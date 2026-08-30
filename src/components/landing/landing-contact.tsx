"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, Phone, Send, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";

const interestOptions = [
  { value: "restaurant", label: "Voice AI for Restaurant" },
  { value: "salon", label: "Salon" },
  { value: "healthcare", label: "Healthcare" },
  { value: "other", label: "Other" },
] as const;

type Interest = (typeof interestOptions)[number]["value"];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function LandingContact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [interest, setInterest] = useState<Interest>("restaurant");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Name, email, and message are required");
      return;
    }
    if (message.trim().length < 10) {
      toast.error("Please provide a bit more detail in your message");
      return;
    }

    setBusy(true);
    try {
      await api.post("/api/contact", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        businessName: businessName.trim() || undefined,
        interest,
        message: message.trim(),
      });
      toast.success("Thanks! We'll be in touch shortly.");
      setName("");
      setEmail("");
      setPhone("");
      setBusinessName("");
      setInterest("restaurant");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send inquiry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="contact" className="py-20 sm:py-28 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Contact us
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Let&apos;s talk about your business
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tell us about your restaurant, salon, or clinic — we&apos;ll show you how
            Cherry Voice AI can handle your phone line.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-14 max-w-3xl"
        >
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
            <div className="h-1 bg-gradient-to-r from-cherry-500 via-cherry-600 to-cherry-700" />
            <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="contact-name"
                      required
                      className="pl-10"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="contact-email"
                      type="email"
                      required
                      className="pl-10"
                      placeholder="you@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-phone">
                    Phone <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="contact-phone"
                      type="tel"
                      className="pl-10"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-business">
                    Restaurant / Business name{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="contact-business"
                    placeholder="Your business name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-interest">Service interest</Label>
                <Select
                  value={interest}
                  onValueChange={(v) => setInterest(v as Interest)}
                  disabled={busy}
                >
                  <SelectTrigger id="contact-interest">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {interestOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Message / Inquiry</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="contact-message"
                    required
                    className="min-h-[140px] pl-10"
                    placeholder="Tell us about your call volume, current setup, or what you'd like Cherry to handle..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-foreground text-background hover:bg-foreground/90 sm:w-auto"
                disabled={busy}
              >
                {busy ? "Sending..." : "Send Inquiry"}
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
