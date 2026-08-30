"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Mic2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { api } from "@/lib/api-client";
import { CherryVoicePicker } from "@/components/cherry-voice/voice-picker";

export default function CherryVoiceSettingsPage() {
  const { data, loading, refetch } = useApiQuery<{
    settings: {
      widgetToken: string;
      inworldVoiceId: string;
      greeting: string | null;
      widgetPosition: "bottom-right" | "bottom-left";
      accentColor: string;
      isEnabled: boolean;
      restaurantName: string;
      restaurantSlug: string;
    };
    embed_script: string;
    demo_url: string;
    configured: boolean;
  }>("/api/settings/cherry-voice");

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const settings = data?.settings;

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await api.patch("/api/settings/cherry-voice", patch);
      await refetch();
      toast.success("Cherry Voice settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const copyEmbed = async () => {
    if (!data?.embed_script) return;
    await navigator.clipboard.writeText(data.embed_script);
    setCopied(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const rotateToken = async () => {
    try {
      await api.post("/api/settings/cherry-voice/rotate-token", {});
      await refetch();
      toast.success("Widget token rotated — update embed code on your site");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rotate failed");
    }
  };

  if (loading || !settings) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website Voice Widget"
        description="Cherry Voice native web agent — Deepgram STT, Gemini LLM, Inworld TTS."
      >
        <Badge variant={data?.configured ? "success" : "secondary"}>
          {data?.configured ? "Providers configured" : "Missing API keys"}
        </Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic2 className="h-5 w-5" />
            Voice & widget appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable website widget</p>
              <p className="text-xs text-muted-foreground">Show the floating call button on your site</p>
            </div>
            <Switch
              checked={settings.isEnabled}
              onCheckedChange={(checked) => save({ is_enabled: checked })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Inworld voice</Label>
            <CherryVoicePicker
              value={settings.inworldVoiceId}
              onChange={(voiceId) => save({ inworld_voice_id: voiceId })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Greeting (spoken when call starts)</Label>
            <Input
              defaultValue={settings.greeting ?? ""}
              placeholder={`Hi! Thanks for calling ${settings.restaurantName}. How can I help?`}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val !== (settings.greeting ?? "")) save({ greeting: val || null });
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Widget position</Label>
              <Select
                value={settings.widgetPosition}
                onValueChange={(v) =>
                  save({ widget_position: v as "bottom-right" | "bottom-left" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom right</SelectItem>
                  <SelectItem value="bottom-left">Bottom left</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Accent color</Label>
              <Input
                type="color"
                defaultValue={settings.accentColor}
                className="h-10 w-full cursor-pointer"
                onBlur={(e) => save({ accent_color: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embed on your website</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste this script before <code>&lt;/body&gt;</code> on your restaurant website. The
            public widget token authenticates callers — your integration API key stays server-side.
          </p>
          <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
            {data?.embed_script}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={copyEmbed}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy embed code"}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={rotateToken}>
              <RefreshCw className="h-4 w-4" />
              Rotate token
            </Button>
            {data?.demo_url && (
              <Button variant="secondary" size="sm" asChild>
                <a href={data.demo_url} target="_blank" rel="noreferrer">
                  Open demo
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Widget token: <code className="rounded bg-muted px-1">{settings.widgetToken}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
