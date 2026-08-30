"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bot, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { VoicePicker } from "@/components/omnidim/voice-picker";
import { OmnidimSyncButton } from "@/components/omnidim/omnidim-sync-button";
import { EmbedCodeBlock } from "@/components/omnidim/embed-code-block";

function ToggleRow({
  title,
  desc,
  defaultChecked,
}: {
  title: string;
  desc: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="pr-4">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

export default function OmnidimSettingsPage() {
  const [reveal, setReveal] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const { data: agentsData } = useApiQuery<{
    agents: Array<{ omnidim_agent_id?: string; name?: string }>;
  }>("/api/agents");
  const { data: omnidimStatus } = useApiQuery<{
    app_base_url: string;
    unreachable_from_cloud: boolean;
    tunnel_required: boolean;
    tunnel_hint: string | null;
  }>("/api/settings/omnidim");
  const defaultAgentId = agentsData?.agents?.[0]?.omnidim_agent_id ?? "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Omnidim"
        description="Voice agent integration, sync, and website widget."
      />

      {omnidimStatus?.tunnel_required && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex gap-3 pt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                APP_BASE_URL is not reachable from Omnidim cloud
              </p>
              <p className="text-muted-foreground">
                Current value:{" "}
                <code className="rounded bg-muted px-1">{omnidimStatus.app_base_url}</code>. Voice
                agent tools (get_menu, create_order) will fail during web calls until you expose
                this server with a public HTTPS URL.
              </p>
              <p className="text-muted-foreground">{omnidimStatus.tunnel_hint}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Omnidim integration
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Live
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Default voice</Label>
            <VoicePicker value={voiceId} onChange={setVoiceId} autoLoad />
          </div>
          <div className="space-y-1.5">
            <Label>API key</Label>
            <div className="relative">
              <Input
                readOnly
                type={reveal ? "text" : "password"}
                value="Configured via OMNIDIM_API_KEY"
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored in your <code className="rounded bg-muted px-1">.env</code> as{" "}
              <code className="rounded bg-muted px-1">OMNIDIM_API_KEY</code>.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default agent</Label>
              <Select defaultValue={defaultAgentId || "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agentsData?.agents?.map((a) => (
                    <SelectItem key={a.omnidim_agent_id} value={a.omnidim_agent_id ?? "none"}>
                      {a.name ?? a.omnidim_agent_id}
                    </SelectItem>
                  )) ?? <SelectItem value="none">No agents synced</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Webhook URL</Label>
              <Input readOnly defaultValue="/api/omnidim/webhook" />
            </div>
          </div>
          <ToggleRow
            title="Auto-create orders"
            desc="Turn completed voice orders into dashboard orders automatically"
            defaultChecked
          />
          <ToggleRow
            title="Record calls"
            desc="Store call recordings for quality and training"
            defaultChecked
          />
          {defaultAgentId && (
            <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
              <Label>Website voice widget embed</Label>
              <p className="text-xs text-muted-foreground">
                Add a click-to-talk widget on your restaurant website.
              </p>
              <EmbedCodeBlock agentId={defaultAgentId} />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <OmnidimSyncButton />
            <Button onClick={() => toast.success("Omnidim settings saved")}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
