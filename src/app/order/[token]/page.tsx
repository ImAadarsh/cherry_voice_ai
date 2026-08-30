"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Check,
  Clock,
  CreditCard,
  Download,
  Loader2,
  MapPin,
  Package,
  Phone,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type OrderPayload = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  orderType: string;
  totalFormatted: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  placedAt: string;
  updatedAt: string;
  restaurant: { name: string; phone: string | null; address: string | null };
  items: Array<{
    name: string;
    quantity: number;
    totalFormatted: string;
    notes: string | null;
  }>;
  paymentLinkUrl: string | null;
  canPay: boolean;
  canDownloadInvoice: boolean;
};

const TRACK_STEPS = [
  { id: "pending", label: "Pending", icon: Clock },
  { id: "confirmed", label: "Confirmed", icon: Check },
  { id: "preparing", label: "Preparing", icon: Package },
  { id: "ready", label: "Ready", icon: Package },
  { id: "delivered", label: "Delivered", icon: Truck },
] as const;

function stepIndex(status: string): number {
  const idx = TRACK_STEPS.findIndex((s) => s.id === status);
  return idx >= 0 ? idx : 0;
}

export default function CustomerOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-mesh">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CustomerOrderView />
    </Suspense>
  );
}

function CustomerOrderView() {
  const params = useParams();
  const token = String(params.token ?? "");
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [address, setAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<OrderPayload>(`/api/public/orders/${token}`);
      setOrder(data);
      setAddress(data.deliveryAddress ?? "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      toast.success("Payment received — thank you!");
    }
  }, [searchParams]);

  const activeStep = useMemo(() => (order ? stepIndex(order.status) : 0), [order]);

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await api.post<{ paymentLinkUrl: string }>(
        `/api/public/orders/${token}/pay`,
      );
      window.location.href = res.paymentLinkUrl;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPaying(false);
    }
  };

  const handleAddressSave = async () => {
    if (!address.trim()) {
      toast.error("Enter a delivery address");
      return;
    }
    setSavingAddress(true);
    try {
      await api.patch(`/api/public/orders/${token}`, {
        delivery_address: address.trim(),
      });
      toast.success("Address updated — the restaurant has been notified");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingAddress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-mesh px-4">
        <Logo />
        <p className="text-muted-foreground">Order not found or link expired.</p>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-mesh px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo className="mb-4" />
          <h1 className="font-display text-2xl font-bold">{order.restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">Order {order.orderNumber}</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between gap-1">
              {TRACK_STEPS.map((step, i) => {
                const Icon = step.icon;
                const done = i <= activeStep;
                const active = i === activeStep;
                return (
                  <div key={step.id} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full border text-xs",
                        done && "border-primary bg-primary text-primary-foreground",
                        !done && "border-border bg-muted text-muted-foreground",
                        active && "ring-2 ring-primary/30",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">{step.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Badge variant="outline" className="capitalize">
                {order.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant={order.paymentStatus === "paid" ? "success" : "warning"}>
                Payment: {order.paymentStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="divide-y text-sm">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.totalFormatted}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t pt-3 font-semibold">
              <span>Total</span>
              <span>{order.totalFormatted}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {order.customerName && (
              <p>
                <span className="text-muted-foreground">Name:</span> {order.customerName}
              </p>
            )}
            {order.customerPhone && (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {order.customerPhone}
              </p>
            )}
            {order.orderType === "delivery" && (
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Delivery address
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, zip"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddressSave}
                  disabled={savingAddress}
                >
                  {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update address"}
                </Button>
              </div>
            )}
            {order.restaurant.phone && (
              <p className="text-muted-foreground">
                Restaurant: {order.restaurant.phone}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row">
          {order.canPay && (
            <Button className="flex-1 gap-2" onClick={handlePay} disabled={paying}>
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Pay now
            </Button>
          )}
          {order.canDownloadInvoice && (
            <Button variant="outline" className="flex-1 gap-2" asChild>
              <a
                href={`/api/public/orders/${token}/invoice?print=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" /> Download invoice
              </a>
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Status updates automatically every few seconds.
        </p>
      </div>
    </div>
  );
}
