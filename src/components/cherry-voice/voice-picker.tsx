"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import { INWORLD_VOICES } from "@/lib/voice/inworld-voices";

type VoiceGroup = {
  langCode: string;
  label: string;
  voices: Array<{
    voiceId: string;
    displayName: string;
    description?: string;
    langCode: string;
    gender?: string;
  }>;
};

type CherryVoicePickerProps = {
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
};

export function CherryVoicePicker({ value, onChange, disabled }: CherryVoicePickerProps) {
  const { data, loading } = useApiQuery<{ groups: VoiceGroup[]; source?: string }>(
    "/api/voice/inworld/voices",
  );

  const groups = useMemo(() => {
    if (data?.groups?.length) return data.groups;
    return [
      {
        langCode: "EN_US",
        label: "English (US)",
        voices: INWORLD_VOICES.map((v) => ({
          voiceId: v.id,
          displayName: v.label,
          description: v.description,
          langCode: "EN_US",
          gender: undefined as string | undefined,
        })),
      },
    ];
  }, [data]);

  const [langCode, setLangCode] = useState("EN_US");
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedGroup = groups.find((g) => g.langCode === langCode) ?? groups[0];
  const voices = selectedGroup?.voices ?? [];

  useEffect(() => {
    if (!value && voices.length > 0) {
      onChange(voices[0].voiceId);
    }
  }, [value, voices, onChange]);

  useEffect(() => {
    if (!value) return;
    const voice = groups.flatMap((g) => g.voices).find((v) => v.voiceId === value);
    if (voice && voice.langCode !== langCode) {
      setLangCode(voice.langCode);
    }
  }, [value, groups, langCode]);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewing(false);
  };

  const previewVoice = async () => {
    if (!value) return;
    stopPreview();
    setPreviewing(true);
    try {
      const res = await api.post<{ audio_base64: string; mime_type: string }>(
        "/api/voice/inworld/preview",
        { voice_id: value },
      );
      const audio = new Audio(`data:${res.mime_type};base64,${res.audio_base64}`);
      audioRef.current = audio;
      audio.onended = () => setPreviewing(false);
      audio.onerror = () => {
        setPreviewing(false);
        toast.error("Could not play voice preview");
      };
      await audio.play();
    } catch (e) {
      toast.error((e as Error).message);
      setPreviewing(false);
    }
  };

  useEffect(() => () => stopPreview(), []);

  const selectedVoice = voices.find((v) => v.voiceId === value);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Language / region</Label>
          <Select
            value={selectedGroup?.langCode ?? langCode}
            onValueChange={(code) => {
              setLangCode(code);
              const group = groups.find((g) => g.langCode === code);
              if (group?.voices[0]) onChange(group.voices[0].voiceId);
            }}
            disabled={disabled || loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading languages…" : "Select language"} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.langCode} value={group.langCode}>
                  {group.label} ({group.voices.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Voice</Label>
          <Select value={value || undefined} onValueChange={onChange} disabled={disabled || loading}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading voices…" : "Select voice"} />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {voices.map((voice) => (
                <SelectItem key={voice.voiceId} value={voice.voiceId}>
                  {voice.displayName}
                  {voice.gender ? ` · ${voice.gender}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedVoice?.description && (
        <p className="text-xs text-muted-foreground">{selectedVoice.description}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!value || previewing || disabled}
          onClick={() => void previewVoice()}
        >
          {previewing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Preview voice
        </Button>
        {previewing && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={stopPreview}>
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        )}
        {loading && (
          <span className="text-xs text-muted-foreground">Loading Inworld voice catalog…</span>
        )}
      </div>
    </div>
  );
}
