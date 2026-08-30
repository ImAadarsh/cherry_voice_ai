"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import { CurrencySelect } from "@/components/shared/currency-select";

export default function GeneralSettingsPage() {
  const { data, refetch } = useApiQuery<{ restaurant: Record<string, unknown> }>("/api/settings");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    const r = data?.restaurant;
    if (!r) return;
    setName(String(r.name ?? ""));
    setPhone(String(r.phone ?? ""));
    setAddress(String(r.address_line1 ?? ""));
    setCurrency(String(r.currency ?? "USD"));
  }, [data]);

  const save = async () => {
    try {
      await api.patch("/api/settings", {
        restaurant: { name, phone, addressLine1: address, currency },
      });
      toast.success("Profile saved");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="General"
        description="Restaurant profile, currency, and contact details."
        className="[&_h1]:flex [&_h1]:items-center [&_h1]:gap-2"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Restaurant profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Restaurant name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencySelect value={currency} onValueChange={setCurrency} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={save}>Save changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
