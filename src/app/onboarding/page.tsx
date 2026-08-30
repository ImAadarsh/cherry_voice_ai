"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  ChefHat,
  Mic2,
  Bot,
  Phone,
  Rocket,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  Check,
  LogIn,
  Sparkles,
  Upload,
  FileText,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { CurrencySelect } from "@/components/shared/currency-select";
import { VoicePicker } from "@/components/omnidim/voice-picker";
import { WebCallPanel } from "@/components/omnidim/web-call-panel";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "account", label: "Account", icon: UserPlus, desc: "Create or sign in" },
  { id: "profile", label: "Profile", icon: Building2, desc: "Restaurant details" },
  { id: "menu", label: "Menu", icon: ChefHat, desc: "Import your menu" },
  { id: "voice", label: "Voice", icon: Mic2, desc: "Pick a voice" },
  { id: "agent", label: "Agent", icon: Bot, desc: "Configure AI" },
  { id: "phone", label: "Phone", icon: Phone, desc: "Attach number" },
  { id: "review", label: "Go Live", icon: Rocket, desc: "Launch" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const AGENT_PROMPT = `You are a friendly voice ordering assistant for {{restaurant_name}}.
Take orders clearly, confirm items and quantities, mention prices, and collect delivery or pickup preference.
If unsure about a menu item, ask clarifying questions. Be warm and efficient.`;

function asList(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of keys) {
      const val = obj[key];
      if (Array.isArray(val)) return val;
    }
  }
  return [];
}

type ProcessingStatus = "idle" | "uploading" | "extracting" | "ready" | "failed";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>("account");
  const [busy, setBusy] = useState(false);
  const [accountMode, setAccountMode] = useState<"register" | "login">("register");

  const [account, setAccount] = useState({
    name: "",
    email: "",
    password: "",
    restaurantName: "",
  });
  const [profile, setProfile] = useState({
    currency: "USD",
    city: "",
    country: "US",
    deliveryArea: "",
    addressLine1: "",
    hours: "",
    policies: "",
    cuisineType: "",
  });
  const [menuText, setMenuText] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [menuImages, setMenuImages] = useState<File[]>([]);
  const [menuPdf, setMenuPdf] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");
  const [processingMessage, setProcessingMessage] = useState("");
  const [extracted, setExtracted] = useState<Array<{ name: string; price: number; description?: string }>>([]);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [agentName, setAgentName] = useState("Ruby");
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id?: string | number; phone_number?: string }>>([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const next = () => {
    const i = STEPS.findIndex((s) => s.id === step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1].id);
  };
  const back = () => {
    const i = STEPS.findIndex((s) => s.id === step);
    if (i > 0) setStep(STEPS[i - 1].id);
  };

  const handleAccount = async () => {
    if (!account.email || !account.password) {
      toast.error("Email and password are required");
      return;
    }
    if (accountMode === "register") {
      if (account.password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      if (!account.name || !account.restaurantName) {
        toast.error("Name and restaurant name are required");
        return;
      }
    }

    setBusy(true);
    try {
      if (accountMode === "login") {
        const res = await api.post<{ restaurantId: number }>("/api/auth/login", {
          email: account.email,
          password: account.password,
        });
        setRestaurantId(res.restaurantId);
        toast.success("Signed in");
      } else {
        const res = await api.post<{ restaurantId: number }>("/api/auth/register", account);
        setRestaurantId(res.restaurantId);
        toast.success("Account created");
      }
      next();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleProfile = async () => {
    if (!profile.city || !profile.country) {
      toast.error("City and country are required");
      return;
    }
    setBusy(true);
    try {
      await api.patch("/api/settings", {
        restaurant: {
          currency: profile.currency,
          city: profile.city,
          country: profile.country,
          addressLine1: profile.addressLine1,
        },
        settings: {
          delivery: { area: profile.deliveryArea },
          restaurant: {
            hours: profile.hours,
            policies: profile.policies,
            cuisine_type: profile.cuisineType,
          },
        },
      });
      toast.success("Profile saved");
      next();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleMenuPipeline = async (save = false) => {
    setBusy(true);
    setProcessingStatus("uploading");
    setProcessingMessage("Uploading files…");
    try {
      if (menuImages.length > 0) {
        const fd = new FormData();
        menuImages.forEach((f) => fd.append("files", f));
        await api.upload("/api/onboarding/menu/upload-image", fd);
      }
      if (menuPdf) {
        const fd = new FormData();
        fd.append("file", menuPdf);
        await api.upload("/api/onboarding/menu/upload-pdf", fd);
      }
      if (websiteUrl.trim()) {
        setProcessingMessage("Fetching website…");
        await api.post("/api/onboarding/restaurant/website", { url: websiteUrl.trim() });
      }

      setProcessingStatus("extracting");
      setProcessingMessage("Extracting menu & context (Gemini / Omnidim)…");
      const res = await api.post<{
        menuItems: Array<{ name: string; price: number; description?: string }>;
        status: ProcessingStatus;
        provider: string;
        errors?: string[];
        savedMenuItemIds?: number[];
      }>("/api/onboarding/extract", { saveMenu: save, plainText: menuText || undefined });

      setExtracted(res.menuItems);
      setProcessingStatus(res.status === "ready" ? "ready" : res.status === "failed" ? "failed" : "ready");
      setProcessingMessage(
        res.errors?.length
          ? `${res.errors.join("; ")} (${res.provider})`
          : res.menuItems.length > 0
            ? `Found ${res.menuItems.length} item(s) via ${res.provider}`
            : `No items extracted (${res.provider}) — add GEMINI_API_KEY for AI extraction`,
      );
      toast.success(save ? "Menu saved to database" : "Extraction complete — review items below");
      if (save) next();
    } catch (e) {
      setProcessingStatus("failed");
      setProcessingMessage((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleGeneratePrompt = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ prompt: string }>("/api/onboarding/agent/generate-prompt");
      setAgentPrompt(res.prompt);
      toast.success("Agent prompt generated from your restaurant data");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleMenuExtract = async (save = false) => {
    if (!menuText.trim() && menuImages.length === 0 && !menuPdf && !websiteUrl.trim()) {
      toast.error("Add menu photos, PDF, website URL, or paste text");
      return;
    }
    if (menuImages.length || menuPdf || websiteUrl.trim()) {
      await handleMenuPipeline(save);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ extracted: Array<{ name: string; price: number }> }>(
        "/api/menu/extract",
        { text: menuText, save },
      );
      setExtracted(res.extracted);
      toast.success(save ? "Menu items saved to database" : "Menu extracted — review below");
      if (save) next();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!agentName.trim()) {
      toast.error("Agent name is required");
      return;
    }
    setBusy(true);
    try {
      const prompt =
        agentPrompt ||
        AGENT_PROMPT.replace("{{restaurant_name}}", account.restaurantName || "your restaurant");
      const res = await api.post<{ agent: { id?: string | number }; localId?: number }>(
        "/api/agents",
        {
          name: agentName,
          welcome_message: `Thanks for calling ${account.restaurantName || "us"}! How can I help you today?`,
          context_breakdown: [{ title: "Instructions", body: prompt, type: "text" }],
          voice_id: selectedVoice || undefined,
        },
      );
      const id = res.agent?.id ?? res.localId;
      setCreatedAgentId(id != null ? String(id) : null);
      await api.post("/api/omnidim/sync");
      toast.success("Voice agent created");
      next();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleLoadPhones = async () => {
    setBusy(true);
    try {
      const res = await api.get<unknown>("/api/omnidim/phone-numbers");
      const list = asList(res, "phone_numbers", "data", "numbers") as Array<{
        id?: string | number;
        phone_number?: string;
      }>;
      setPhoneNumbers(list);
      if (list.length) {
        const first = list[0];
        setSelectedPhone(String(first.id ?? first.phone_number ?? ""));
      }
      toast.success(list.length ? `Found ${list.length} number(s)` : "No phone numbers in your Omnidim account");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAttachPhone = async () => {
    if (!selectedPhone || !createdAgentId) {
      toast.error("Select a phone number and create an agent first");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/omnidim/phone-numbers/attach", {
        phone_number_id: selectedPhone,
        agent_id: createdAgentId,
      });
      toast.success("Phone number attached");
      next();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoLive = async () => {
    setBusy(true);
    try {
      await api.post("/api/omnidim/sync");
      toast.success("You're live! Welcome to Cherry Voice AI.");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const summary = useMemo(
    () => ({
      restaurant: account.restaurantName,
      currency: profile.currency,
      location: [profile.city, profile.country].filter(Boolean).join(", "),
      menuItems: extracted.length,
      agent: agentName,
      phone: selectedPhone,
    }),
    [account, profile, extracted, agentName, selectedPhone],
  );

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-mesh" />
      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo className="mb-6" />
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Set up <span className="text-gradient">Cherry Voice AI</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Launch your voice-powered restaurant in minutes. Every step saves to your live database.
          </p>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex justify-between text-xs text-muted-foreground">
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-cherry-400"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        <ol className="mb-8 hidden gap-2 sm:flex sm:flex-wrap sm:justify-center">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < stepIndex;
            const active = s.id === step;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active && "border-primary bg-primary text-primary-foreground shadow-glow",
                  done && !active && "border-cherry-200 bg-cherry-50 text-cherry-700 dark:border-cherry-800 dark:bg-cherry-950/50 dark:text-cherry-300",
                  !active && !done && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span>{s.label}</span>
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="border-border/60 shadow-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    {(() => {
                      const Icon = STEPS[stepIndex].icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <CardTitle className="font-display">{STEPS[stepIndex].label}</CardTitle>
                    <CardDescription>{STEPS[stepIndex].desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {step === "account" && (
                  <>
                    <div className="flex rounded-lg bg-muted p-1">
                      <button
                        type="button"
                        onClick={() => setAccountMode("register")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition",
                          accountMode === "register" ? "bg-background shadow-soft" : "text-muted-foreground",
                        )}
                      >
                        <UserPlus className="h-4 w-4" /> New restaurant
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountMode("login")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition",
                          accountMode === "login" ? "bg-background shadow-soft" : "text-muted-foreground",
                        )}
                      >
                        <LogIn className="h-4 w-4" /> Sign in
                      </button>
                    </div>
                    {accountMode === "register" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Your name</Label>
                          <Input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Restaurant name</Label>
                          <Input
                            value={account.restaurantName}
                            onChange={(e) => setAccount({ ...account, restaurantName: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={account.password}
                        onChange={(e) => setAccount({ ...account, password: e.target.value })}
                        placeholder={accountMode === "register" ? "Min. 8 characters" : ""}
                      />
                    </div>
                  </>
                )}

                {step === "profile" && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <CurrencySelect
                          value={profile.currency}
                          onValueChange={(code) => setProfile({ ...profile, currency: code })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Country (ISO)</Label>
                        <Input value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input value={profile.addressLine1} onChange={(e) => setProfile({ ...profile, addressLine1: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Delivery area</Label>
                      <Textarea
                        value={profile.deliveryArea}
                        onChange={(e) => setProfile({ ...profile, deliveryArea: e.target.value })}
                        placeholder="Neighborhoods or zip codes you deliver to"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Cuisine type</Label>
                        <Input
                          value={profile.cuisineType}
                          onChange={(e) => setProfile({ ...profile, cuisineType: e.target.value })}
                          placeholder="Italian, Indian, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hours</Label>
                        <Input
                          value={profile.hours}
                          onChange={(e) => setProfile({ ...profile, hours: e.target.value })}
                          placeholder="Mon–Fri 11am–10pm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Policies</Label>
                      <Textarea
                        rows={3}
                        value={profile.policies}
                        onChange={(e) => setProfile({ ...profile, policies: e.target.value })}
                        placeholder="Allergen info, refund policy, minimum order…"
                      />
                    </div>
                  </>
                )}

                {step === "menu" && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          <Upload className="h-4 w-4" /> Menu photos
                        </Label>
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => setMenuImages(Array.from(e.target.files ?? []))}
                        />
                        {menuImages.length > 0 && (
                          <p className="text-xs text-muted-foreground">{menuImages.length} image(s) selected</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4" /> Menu PDF
                        </Label>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setMenuPdf(e.target.files?.[0] ?? null)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Globe className="h-4 w-4" /> Restaurant website
                      </Label>
                      <Input
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://yourrestaurant.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Or paste menu text</Label>
                      <Textarea
                        rows={5}
                        value={menuText}
                        onChange={(e) => setMenuText(e.target.value)}
                        placeholder={"Margherita Pizza $14\nTruffle Fries $9\nFresh Lemonade $5"}
                      />
                    </div>
                    {processingStatus !== "idle" && (
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                          processingStatus === "ready" && "border-green-200 bg-green-50 text-green-800",
                          processingStatus === "failed" && "border-red-200 bg-red-50 text-red-800",
                          (processingStatus === "uploading" || processingStatus === "extracting") &&
                            "border-primary/30 bg-primary/5 text-primary",
                        )}
                      >
                        {(processingStatus === "uploading" || processingStatus === "extracting") && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <span>{processingMessage || processingStatus}</span>
                      </div>
                    )}
                    {extracted.length > 0 && (
                      <ul className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
                        {extracted.map((it, i) => (
                          <li key={i} className="flex justify-between border-b border-border/50 py-2 last:border-0">
                            <span>{it.name}</span>
                            <span className="tabular text-muted-foreground">
                              {formatMoney(it.price, profile.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {step === "voice" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Pick a voice for your agent with live preview from Omnidim providers.
                    </p>
                    <VoicePicker
                      value={selectedVoice}
                      onChange={setSelectedVoice}
                      autoLoad
                    />
                  </>
                )}

                {step === "agent" && (
                  <>
                    <div className="space-y-2">
                      <Label>Agent name</Label>
                      <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleGeneratePrompt} disabled={busy}>
                      <Sparkles className="mr-2 h-4 w-4" /> Generate prompt from menu & profile
                    </Button>
                    <div className="space-y-2">
                      <Label>Agent prompt (preview)</Label>
                      <Textarea
                        rows={8}
                        className="bg-muted/40 font-mono text-xs"
                        value={
                          agentPrompt ||
                          AGENT_PROMPT.replace("{{restaurant_name}}", account.restaurantName || "your restaurant")
                        }
                        onChange={(e) => setAgentPrompt(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {step === "phone" && (
                  <>
                    <Button variant="outline" onClick={handleLoadPhones} disabled={busy}>
                      Load phone numbers
                    </Button>
                    {phoneNumbers.length > 0 && (
                      <div className="space-y-2">
                        <Label>Phone number</Label>
                        <select
                          className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus-ring"
                          value={selectedPhone}
                          onChange={(e) => setSelectedPhone(e.target.value)}
                        >
                          {phoneNumbers.map((p, i) => (
                            <option key={i} value={String(p.id ?? p.phone_number ?? i)}>
                              {p.phone_number ?? `Number ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {step === "review" && (
                  <>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      {Object.entries(summary).map(([k, v]) => (
                        <div key={k} className="rounded-xl border bg-muted/20 p-3">
                          <dt className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
                          <dd className="font-medium">{String(v || "—")}</dd>
                        </div>
                      ))}
                      {restaurantId && (
                        <div className="rounded-xl border bg-primary/5 p-3 sm:col-span-2">
                          <dt className="text-muted-foreground">Restaurant ID</dt>
                          <dd className="font-mono text-sm font-medium">{restaurantId}</dd>
                        </div>
                      )}
                    </dl>
                    {createdAgentId && (
                      <div className="mt-6 rounded-xl border bg-card p-4">
                        <h3 className="mb-1 font-semibold">Try your agent before go-live</h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                          Test a browser voice call — no phone number required. Powered by Omnidim Sessions.
                        </p>
                        <WebCallPanel
                          agentId={createdAgentId}
                          agentName={agentName}
                          mode="demo"
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={back} disabled={stepIndex === 0 || busy}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step === "account" && (
            <Button onClick={handleAccount} disabled={busy}>
              {accountMode === "login" ? "Sign in" : "Create account"} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "profile" && (
            <Button onClick={handleProfile} disabled={busy}>
              Save & continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "menu" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleMenuExtract(false)} disabled={busy}>
                Extract
              </Button>
              <Button onClick={() => handleMenuExtract(true)} disabled={busy}>
                Save menu <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
          {step === "voice" && (
            <Button onClick={next} disabled={busy}>
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "agent" && (
            <Button onClick={handleCreateAgent} disabled={busy}>
              Create agent <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "phone" && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={next} disabled={busy}>
                Skip
              </Button>
              <Button onClick={handleAttachPhone} disabled={busy}>
                Attach & continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
          {step === "review" && (
            <Button onClick={handleGoLive} disabled={busy} className="gap-1">
              Go live <Rocket className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Already set up? <Link href="/login" className="text-primary hover:underline">Sign in</Link> ·{" "}
          <Link href="/dashboard" className="text-primary hover:underline">Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
