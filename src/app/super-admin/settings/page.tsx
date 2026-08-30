"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Key, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";

type SecretField = { configured: boolean; hint: string | null };

type PlatformSettings = {
  settings: {
    omnidim_api_key: SecretField;
    gemini_api_key: SecretField;
    gemini_model: string | null;
    default_voice_provider: string | null;
    app_base_url: string | null;
  };
};

export default function SuperAdminSettingsPage() {
  const { data, loading, error, retry, refetch } = useApiQuery<PlatformSettings>(
    "/api/super-admin/platform-settings",
  );
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voiceKey, setVoiceKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  const settings = data?.settings;

  const saveKeys = async () => {
    const payload: Record<string, string> = {};
    if (voiceKey.trim()) payload.omnidim_api_key = voiceKey.trim();
    if (geminiKey.trim()) payload.gemini_api_key = geminiKey.trim();
    if (!Object.keys(payload).length) {
      toast.error("Enter at least one API key to save");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/super-admin/platform-settings", payload);
      toast.success("Platform API keys updated");
      setVoiceKey("");
      setGeminiKey("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const testVoice = async () => {
    setTestingVoice(true);
    try {
      const res = await api.post<{ success: boolean; latencyMs: number; message: string }>(
        "/api/super-admin/settings/test-voice",
      );
      toast.success(`${res.message} (${res.latencyMs}ms)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTestingVoice(false);
    }
  };

  const testGemini = async () => {
    setTestingGemini(true);
    try {
      const res = await api.post<{ success: boolean; latencyMs: number; message: string }>(
        "/api/super-admin/settings/test-gemini",
      );
      toast.success(`${res.message} (${res.latencyMs}ms)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTestingGemini(false);
    }
  };

  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Platform settings</h1>
        <p className="text-sm text-zinc-500">
          Global API keys and voice provider defaults (super admin only)
        </p>
      </div>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-base text-white">Platform API keys</CardTitle>
          </div>
          <CardDescription>
            Stored in platform_settings with .env fallback. Secrets are never returned in full.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="h-32 animate-pulse rounded-lg bg-white/[0.04]" />
          ) : (
            <>
              <div className="space-y-3 rounded-lg border border-white/[0.06] p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-200">Voice AI Platform API Key</Label>
                  <Badge variant={settings?.omnidim_api_key.configured ? "success" : "destructive"}>
                    {settings?.omnidim_api_key.configured ? "Configured" : "Missing"}
                  </Badge>
                </div>
                {settings?.omnidim_api_key.hint && (
                  <p className="font-mono text-xs text-zinc-500">Current: {settings.omnidim_api_key.hint}</p>
                )}
                <Input
                  type="password"
                  placeholder="Enter new key to update…"
                  value={voiceKey}
                  onChange={(e) => setVoiceKey(e.target.value)}
                  className="border-white/10 bg-black/20 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-white/10"
                  onClick={testVoice}
                  disabled={testingVoice || !settings?.omnidim_api_key.configured}
                >
                  {testingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Test connection
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border border-white/[0.06] p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-200">Gemini API Key</Label>
                  <Badge variant={settings?.gemini_api_key.configured ? "success" : "secondary"}>
                    {settings?.gemini_api_key.configured ? "Configured" : "Optional"}
                  </Badge>
                </div>
                {settings?.gemini_api_key.hint && (
                  <p className="font-mono text-xs text-zinc-500">Current: {settings.gemini_api_key.hint}</p>
                )}
                <Input
                  type="password"
                  placeholder="Enter new key to update…"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="border-white/10 bg-black/20 font-mono text-sm"
                />
                <p className="text-xs text-zinc-500">Model: {settings?.gemini_model ?? "gemini-3.6-flash"}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-white/10"
                  onClick={testGemini}
                  disabled={testingGemini || !settings?.gemini_api_key.configured}
                >
                  {testingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Test connection
                </Button>
              </div>

              <Button onClick={saveKeys} disabled={saving}>
                {saving ? "Saving…" : "Save API keys"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/[0.06] bg-[#111113]">
        <CardHeader>
          <CardTitle className="text-base text-white">Default voice provider</CardTitle>
          <CardDescription>Applied when provisioning new voice agents</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Input readOnly value="Voice AI Platform" className="border-white/10 bg-black/20" />
          </div>
          <div className="space-y-2">
            <Label>Default language</Label>
            <Input readOnly value="en-US" className="border-white/10 bg-black/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
