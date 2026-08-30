"use client";

import { useEffect, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface VoiceOption {
  id: string | number;
  name: string;
  display_name?: string;
  service?: string;
  language?: string;
  accent?: string;
}

function asVoiceList(raw: unknown): VoiceOption[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const list =
    (obj.voices as unknown[]) ??
    (obj.data as unknown[]) ??
    (Array.isArray(raw) ? (raw as unknown[]) : []);
  return list.map((v, i) => {
    const row = v as Record<string, unknown>;
    return {
      id: (row.id ?? row.voice_id ?? i) as string | number,
      name: String(row.display_name ?? row.name ?? `Voice ${i + 1}`),
      display_name: row.display_name ? String(row.display_name) : undefined,
      service: row.service ? String(row.service) : undefined,
      language: row.language ? String(row.language) : undefined,
      accent: row.accent ? String(row.accent) : undefined,
    };
  });
}

export function VoicePicker({
  value,
  onChange,
  className,
  autoLoad = false,
}: {
  value: string;
  onChange: (voiceId: string) => void;
  className?: string;
  autoLoad?: boolean;
}) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ voices: unknown }>("/api/omnidim/providers");
      setVoices(asVoiceList(res.voices));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) void loadVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const preview = async () => {
    if (!value) return;
    setPreviewing(true);
    try {
      const res = await api.get<{ voice: { sample_url?: string } }>(
        `/api/omnidim/providers/voices/${value}`,
      );
      const url = res.voice?.sample_url;
      if (url) {
        setSampleUrl(url);
        const audio = new Audio(url);
        await audio.play();
      }
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label>Voice</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={voices.length ? "Select voice" : "Load voices first"} />
            </SelectTrigger>
            <SelectContent>
              {voices.map((v) => (
                <SelectItem key={String(v.id)} value={String(v.id)}>
                  {v.name}
                  {v.service ? ` · ${v.service}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={loadVoices} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load voices"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!value || previewing}
          onClick={preview}
          className="gap-1"
        >
          {previewing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sampleUrl ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Preview
        </Button>
      </div>
    </div>
  );
}
