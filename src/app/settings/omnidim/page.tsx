"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bot, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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

export default function VoiceAiSettingsPage() {
  const [voiceId, setVoiceId] = useState("");
  const { data: agentsData } = useApiQuery<{
    agents: Array<{ omnidim_agent_id?: string; name?: string }>;
  }>("/api/agents");
  const { data: voiceAiStatus } = useApiQuery<{
    app_base_url: string;
    unreachable_from_cloud: boolean;
    tunnel_required: boolean;
    tunnel_hint: string | null;
  }>("/api/settings/omnidim");
  const defaultAgentId = agentsData?.agents?.[0]?.omnidim_agent_id ?? "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Voice AI Settings"
        description="Voice agent sync, defaults, and call behavior."
      />

      {voiceAiStatus?.tunnel_required && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex gap-3 pt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Your server URL is not reachable from the voice platform
              </p>
              <p className="text-muted-foreground">
                Current value:{" "}
                <code className="rounded bg-muted px-1">{voiceAiStatus.app_base_url}</code>. Voice
                agent tools (get_menu, create_order) will fail during web calls until you expose
                this server with a public HTTPS URL.
              </p>
              <p className="text-muted-foreground">{voiceAiStatus.tunnel_hint}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Voice AI integration
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
          <div className="flex gap-2 pt-1">
            <OmnidimSyncButton />
            <Button onClick={() => toast.success("Voice AI settings saved")}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
