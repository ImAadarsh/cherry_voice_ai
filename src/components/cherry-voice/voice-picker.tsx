"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INWORLD_VOICES } from "@/lib/voice/inworld-voices";

type CherryVoicePickerProps = {
  value: string;
  onChange: (voiceId: string) => void;
};

export function CherryVoicePicker({ value, onChange }: CherryVoicePickerProps) {
  return (
    <Select value={value || "Sarah"} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select voice" />
      </SelectTrigger>
      <SelectContent>
        {INWORLD_VOICES.map((voice) => (
          <SelectItem key={voice.id} value={voice.id}>
            {voice.label}
            {voice.description ? ` — ${voice.description}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
