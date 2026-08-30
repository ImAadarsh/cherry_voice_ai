"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Megaphone,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OmnidimSyncButton } from "@/components/omnidim/omnidim-sync-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { useOmnidimSync } from "@/hooks/use-omnidim-sync";
import { api } from "@/lib/api-client";

type Campaign = {
  id?: number;
  name?: string;
  status?: string;
  bot_name?: string;
  total_calls?: number;
  completed_calls?: number;
  total_pending_calls?: number;
  create_date?: string;
};

function parseCsv(text: string): Array<{ phone_number: string } & Record<string, string>> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const phoneIdx = headers.findIndex((h) => h.includes("phone"));
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    const phone =
      phoneIdx >= 0 ? cols[phoneIdx] : cols[0];
    return { phone_number: phone, ...row };
  }).filter((r) => r.phone_number);
}

export default function CampaignsPage() {
  useOmnidimSync();
  const { data, loading, refetch } = useApiQuery<{ records?: Campaign[] }>("/api/campaigns");
  const { data: phonesData } = useApiQuery<{
    phone_numbers?: Array<{ id?: number; phone_number?: string; agent_id?: number }>;
  }>("/api/omnidim/phone-numbers");

  const [name, setName] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [contacts, setContacts] = useState<Array<{ phone_number: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const campaigns = data?.records ?? [];
  const phones = phonesData?.phone_numbers ?? [];

  const onCsv = async (file: File) => {
    const text = await file.text();
    setContacts(parseCsv(text));
    toast.success(`Parsed ${parseCsv(text).length} contacts`);
  };

  const createCampaign = async () => {
    if (!name || !phoneId || !contacts.length) {
      toast.error("Name, phone number, and contacts are required");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/campaigns", {
        name,
        phone_number_id: phoneId,
        contact_list: contacts,
      });
      toast.success("Campaign created");
      setCreateOpen(false);
      setName("");
      setContacts([]);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const campaignAction = async (id: number, action: "pause" | "resume") => {
    try {
      await api.put(`/api/campaigns/${id}/action`, { action });
      toast.success(`Campaign ${action}d`);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const cancelCampaign = async (id: number) => {
    if (!confirm("Cancel this campaign?")) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      toast.success("Campaign cancelled");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Bulk outbound call campaigns for your voice agents."
      >
        <div className="flex gap-2">
          <OmnidimSyncButton onSynced={refetch} />
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Active campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaigns yet. Create one with a CSV contact list.
            </p>
          ) : (
            <ul className="divide-y">
              {campaigns.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.bot_name ?? "Agent"} · {c.completed_calls ?? 0}/{c.total_calls ?? 0} completed
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {c.status ?? "unknown"}
                  </Badge>
                  <div className="flex gap-1">
                    {c.status === "paused" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => c.id && campaignAction(c.id, "resume")}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => c.id && campaignAction(c.id, "pause")}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => c.id && cancelCampaign(c.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Win-back lapsed customers" />
            </div>
            <div className="space-y-1.5">
              <Label>Outbound phone number</Label>
              <Select value={phoneId} onValueChange={setPhoneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select number" />
                </SelectTrigger>
                <SelectContent>
                  {phones.map((p) => (
                    <SelectItem key={String(p.id)} value={String(p.id)}>
                      {p.phone_number ?? `Number ${p.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <Link href="/phone-numbers" className="text-primary underline-offset-2 hover:underline">
                  Manage phone numbers
                </Link>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Contact list (CSV)</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onCsv(f);
                }}
              />
              <p className="text-xs text-muted-foreground">
                CSV with a <code className="rounded bg-muted px-1">phone</code> column (E.164 format).
                {contacts.length > 0 && ` ${contacts.length} contacts loaded.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={createCampaign} className="gap-2">
              <Upload className="h-4 w-4" /> Launch campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
