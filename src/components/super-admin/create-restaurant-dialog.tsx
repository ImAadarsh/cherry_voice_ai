"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

export function CreateRestaurantDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    restaurantName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    city: "",
    phone: "",
  });

  const submit = async () => {
    if (!form.restaurantName.trim() || !form.ownerName.trim() || !form.ownerEmail.trim()) {
      toast.error("Restaurant name, owner name, and email are required");
      return;
    }
    if (form.ownerPassword.length < 8) {
      toast.error("Owner password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/super-admin/restaurants", {
        restaurantName: form.restaurantName.trim(),
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPassword: form.ownerPassword,
        city: form.city.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      toast.success("Restaurant and owner account created");
      setOpen(false);
      setForm({
        restaurantName: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        city: "",
        phone: "",
      });
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create restaurant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> New restaurant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create restaurant</DialogTitle>
          <DialogDescription>
            Provision a new tenant with an owner admin account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="restaurantName">Restaurant name</Label>
            <Input
              id="restaurantName"
              value={form.restaurantName}
              onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
              placeholder="Acme Bistro"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner name</Label>
              <Input
                id="ownerName"
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Owner email</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                placeholder="jane@acme.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerPassword">Owner password</Label>
            <Input
              id="ownerPassword"
              type="password"
              value={form.ownerPassword}
              onChange={(e) => setForm((f) => ({ ...f, ownerPassword: e.target.value }))}
              placeholder="Min. 8 characters"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City (optional)</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Portland"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 0100"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
