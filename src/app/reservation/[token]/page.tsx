"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Calendar,
  Check,
  Clock,
  Loader2,
  Phone,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type ReservationPayload = {
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedAt: string;
  status: string;
  statusLabel: string;
  notes: string | null;
  updatedAt: string;
  restaurant: {
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  };
};

const STATUS_FLOW = ["pending", "confirmed", "seated", "completed"] as const;

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  confirmed: Check,
  seated: Users,
  completed: Check,
  cancelled: XCircle,
  no_show: XCircle,
};

export default function CustomerReservationPage() {
  const params = useParams();
  const token = String(params.token ?? "");
  const [reservation, setReservation] = useState<ReservationPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<ReservationPayload>(
        `/api/public/reservations/${token}`,
      );
      setReservation(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const activeIndex = useMemo(() => {
    if (!reservation) return 0;
    if (["cancelled", "no_show"].includes(reservation.status)) return -1;
    const idx = STATUS_FLOW.indexOf(reservation.status as (typeof STATUS_FLOW)[number]);
    return idx >= 0 ? idx : 0;
  }, [reservation]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-mesh px-4">
        <Logo />
        <p className="text-muted-foreground">Reservation not found.</p>
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[reservation.status] ?? Clock;
  const reservedDate = new Date(reservation.reservedAt);

  return (
    <div className="min-h-svh bg-mesh px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo className="mb-4" />
          <h1 className="font-display text-2xl font-bold">{reservation.restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">Reservation for {reservation.customerName}</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Status</span>
              <Badge
                variant={
                  reservation.status === "cancelled" || reservation.status === "no_show"
                    ? "destructive"
                    : reservation.status === "confirmed"
                      ? "success"
                      : "outline"
                }
                className="gap-1 capitalize"
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {reservation.statusLabel}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!["cancelled", "no_show"].includes(reservation.status) && (
              <div className="flex justify-between gap-1">
                {STATUS_FLOW.map((step, i) => {
                  const done = i <= activeIndex;
                  const active = i === activeIndex;
                  return (
                    <div key={step} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={cn(
                          "h-2 w-full rounded-full",
                          done ? "bg-primary" : "bg-muted",
                          active && "ring-2 ring-primary/30",
                        )}
                      />
                      <span className="text-[10px] capitalize text-muted-foreground">{step}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reservation details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {reservedDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              at{" "}
              {reservedDate.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Party of {reservation.partySize}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {reservation.customerPhone}
            </p>
            {reservation.notes && (
              <p className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
                {reservation.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Restaurant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{reservation.restaurant.name}</p>
            {reservation.restaurant.address && <p>{reservation.restaurant.address}</p>}
            {(reservation.restaurant.city || reservation.restaurant.country) && (
              <p>
                {[reservation.restaurant.city, reservation.restaurant.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {reservation.restaurant.phone && (
              <p className="pt-2">
                <a href={`tel:${reservation.restaurant.phone}`} className="text-primary hover:underline">
                  {reservation.restaurant.phone}
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          This page refreshes automatically when your reservation status changes.
        </p>
      </div>
    </div>
  );
}
