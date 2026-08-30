"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calendar, Globe, Plus, Unplug } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import { mapAgentRow } from "@/lib/mappers";

type Integration = {
  id: number;
  name: string;
  integration_type: string;
  description?: string;
  url?: string;
  method?: string;
};

export default function IntegrationsPage() {
  const { data, refetch } = useApiQuery<{ integrations?: Integration[] }>("/api/integrations");
  const { data: agentsData } = useApiQuery<{ agents: Array<Record<string, unknown>> }>(
    "/api/agents",
  );

  const integrations = data?.integrations ?? [];
  const agents = useMemo(
    () => (agentsData?.agents ?? []).map(mapAgentRow),
    [agentsData],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"custom" | "cal">("custom");
  const [attachAgent, setAttachAgent] = useState("");
  const [attachIntegration, setAttachIntegration] = useState("");

  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customMethod, setCustomMethod] = useState("POST");

  const [calName, setCalName] = useState("");
  const [calApiKey, setCalApiKey] = useState("");
  const [calId, setCalId] = useState("");
  const [calTz, setCalTz] = useState("America/New_York");

  const createCustom = async () => {
    try {
      await api.post("/api/integrations/custom-api", {
        name: customName,
        url: customUrl,
        method: customMethod,
      });
      toast.success("Custom API integration created");
      setCreateOpen(false);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const createCal = async () => {
    try {
      await api.post("/api/integrations/cal", {
        name: calName,
        cal_api_key: calApiKey,
        cal_id: calId,
        cal_timezone: calTz,
      });
      toast.success("Cal.com integration created");
      setCreateOpen(false);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const attachToAgent = async () => {
    if (!attachAgent || !attachIntegration) return;
    try {
      await api.post(`/api/integrations/agents/${attachAgent}`, {
        integration_id: Number(attachIntegration),
      });
      toast.success("Integration attached to agent");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Cal.com scheduling and custom API hooks for voice agents."
      >
        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New integration
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Account integrations</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No integrations yet. Create a Cal.com or custom REST hook.
            </p>
          ) : (
            <ul className="divide-y">
              {integrations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.integration_type}
                      {i.url ? ` · ${i.url}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{i.method ?? "—"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unplug className="h-5 w-5" /> Attach to agent
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={attachAgent} onValueChange={setAttachAgent}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.omnidimAgentId} value={a.omnidimAgentId}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Integration</Label>
            <Select value={attachIntegration} onValueChange={setAttachIntegration}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select integration" />
              </SelectTrigger>
              <SelectContent>
                {integrations.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={attachToAgent}>Attach</Button>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create integration</DialogTitle>
          </DialogHeader>
          <Tabs value={createType} onValueChange={(v) => setCreateType(v as "custom" | "cal")}>
            <TabsList className="w-full">
              <TabsTrigger value="custom" className="flex-1 gap-1">
                <Globe className="h-4 w-4" /> Custom API
              </TabsTrigger>
              <TabsTrigger value="cal" className="flex-1 gap-1">
                <Calendar className="h-4 w-4" /> Cal.com
              </TabsTrigger>
            </TabsList>
            <TabsContent value="custom" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={customMethod} onValueChange={setCustomMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={createCustom}>
                Create custom API
              </Button>
            </TabsContent>
            <TabsContent value="cal" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={calName} onChange={(e) => setCalName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cal.com API key</Label>
                <Input
                  type="password"
                  value={calApiKey}
                  onChange={(e) => setCalApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cal ID</Label>
                <Input value={calId} onChange={(e) => setCalId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Input value={calTz} onChange={(e) => setCalTz(e.target.value)} />
              </div>
              <Button className="w-full" onClick={createCal}>
                Create Cal.com integration
              </Button>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        Manage per-agent integrations from{" "}
        <Link href="/agents" className="text-primary underline-offset-2 hover:underline">
          Voice Agents
        </Link>
        .
      </p>
    </div>
  );
}
