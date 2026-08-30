"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Landmark, Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";

type GatewayRow = {
  provider: "stripe" | "razorpay";
  display_name: string | null;
  mode: "test" | "live";
  is_active: number;
  is_default: number;
  public_key: string | null;
  credentials: string | Record<string, unknown> | null;
};

function parseCreds(raw: GatewayRow["credentials"]) {
  if (!raw) return {} as Record<string, string>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, string>;
}

export default function PaymentGatewaysSettingsPage() {
  const { data, refetch } = useApiQuery<{ data: GatewayRow[] }>("/api/settings/payment-gateways");
  const gateways = data?.data ?? [];

  const stripeGw = gateways.find((g) => g.provider === "stripe");
  const razorpayGw = gateways.find((g) => g.provider === "razorpay");

  const [defaultProvider, setDefaultProvider] = useState<"stripe" | "razorpay">("stripe");
  const [stripe, setStripe] = useState({
    isActive: true,
    mode: "test" as "test" | "live",
    publicKey: "",
    secretKey: "",
  });
  const [razorpay, setRazorpay] = useState({
    isActive: true,
    mode: "test" as "test" | "live",
    keyId: "",
    keySecret: "",
  });

  useEffect(() => {
    const def = gateways.find((g) => g.is_default)?.provider;
    if (def === "stripe" || def === "razorpay") setDefaultProvider(def);
    if (stripeGw) {
      const creds = parseCreds(stripeGw.credentials);
      setStripe({
        isActive: Boolean(stripeGw.is_active),
        mode: stripeGw.mode,
        publicKey: stripeGw.public_key ?? "",
        secretKey: creds.secretKey ? "••••••••" : "",
      });
    }
    if (razorpayGw) {
      const creds = parseCreds(razorpayGw.credentials);
      setRazorpay({
        isActive: Boolean(razorpayGw.is_active),
        mode: razorpayGw.mode,
        keyId: razorpayGw.public_key ?? "",
        keySecret: creds.keySecret ? "••••••••" : "",
      });
    }
  }, [gateways, stripeGw, razorpayGw]);

  const saveStripe = async () => {
    try {
      await api.patch("/api/settings/payment-gateways", {
        provider: "stripe",
        isActive: stripe.isActive,
        mode: stripe.mode,
        publicKey: stripe.publicKey || null,
        secretKey: stripe.secretKey === "••••••••" ? undefined : stripe.secretKey || null,
        isDefault: defaultProvider === "stripe",
      });
      toast.success("Stripe settings saved");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveRazorpay = async () => {
    try {
      await api.patch("/api/settings/payment-gateways", {
        provider: "razorpay",
        isActive: razorpay.isActive,
        mode: razorpay.mode,
        publicKey: razorpay.keyId || null,
        keySecret: razorpay.keySecret === "••••••••" ? undefined : razorpay.keySecret || null,
        isDefault: defaultProvider === "razorpay",
      });
      toast.success("Razorpay settings saved");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const testConnection = async (provider: "stripe" | "razorpay") => {
    try {
      await api.post("/api/settings/payment-gateways/test", { provider });
      toast.success(`${provider} connection OK`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const activeCount = useMemo(
    () => gateways.filter((g) => g.is_active).length,
    [gateways],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payment Gateways"
        description="Configure Stripe and Razorpay for payment links and checkout."
      >
        <Badge variant="secondary">{activeCount} active</Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Default gateway</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={defaultProvider}
            onValueChange={(v) => setDefaultProvider(v as "stripe" | "razorpay")}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="razorpay">Razorpay</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Stripe
            {stripeGw?.is_default ? <Badge>Default</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Cards, wallets & payment links</p>
            </div>
            <Switch
              checked={stripe.isActive}
              onCheckedChange={(v) => setStripe((s) => ({ ...s, isActive: v }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select
                value={stripe.mode}
                onValueChange={(v) => setStripe((s) => ({ ...s, mode: v as "test" | "live" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Publishable key</Label>
              <Input
                value={stripe.publicKey}
                onChange={(e) => setStripe((s) => ({ ...s, publicKey: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Secret key</Label>
              <Input
                type="password"
                value={stripe.secretKey}
                onChange={(e) => setStripe((s) => ({ ...s, secretKey: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveStripe}>Save Stripe</Button>
            <Button variant="outline" className="gap-1.5" onClick={() => testConnection("stripe")}>
              <Zap className="h-4 w-4" /> Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" /> Razorpay
            {razorpayGw?.is_default ? <Badge>Default</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">UPI, cards & netbanking</p>
            </div>
            <Switch
              checked={razorpay.isActive}
              onCheckedChange={(v) => setRazorpay((s) => ({ ...s, isActive: v }))}
            />
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select
                value={razorpay.mode}
                onValueChange={(v) => setRazorpay((s) => ({ ...s, mode: v as "test" | "live" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Key ID</Label>
              <Input
                value={razorpay.keyId}
                onChange={(e) => setRazorpay((s) => ({ ...s, keyId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Key secret</Label>
              <Input
                type="password"
                value={razorpay.keySecret}
                onChange={(e) => setRazorpay((s) => ({ ...s, keySecret: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveRazorpay}>Save Razorpay</Button>
            <Button variant="outline" className="gap-1.5" onClick={() => testConnection("razorpay")}>
              <Zap className="h-4 w-4" /> Test connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
