/** Shared Inworld voice catalog (safe for client + server imports). */
export interface InworldVoiceOption {
  id: string;
  label: string;
  description?: string;
}

export const DEFAULT_INWORLD_VOICE = "Sarah";

export const INWORLD_VOICES: InworldVoiceOption[] = [
  { id: "Sarah", label: "Sarah", description: "Warm, friendly female" },
  { id: "Ashley", label: "Ashley", description: "Professional female" },
  { id: "Edward", label: "Edward", description: "Calm male" },
  { id: "Olivia", label: "Olivia", description: "Bright, upbeat female" },
  { id: "Mark", label: "Mark", description: "Confident male" },
  { id: "Dennis", label: "Dennis", description: "Casual male" },
  { id: "Elizabeth", label: "Elizabeth", description: "Elegant female" },
  { id: "Theodore", label: "Theodore", description: "Mature male" },
];

/** Accept any non-empty voice id — catalog is loaded dynamically from Inworld API. */
export function isValidInworldVoice(voiceId: string): boolean {
  const trimmed = voiceId.trim();
  return trimmed.length > 0 && trimmed.length <= 200;
}

/** Known-good voice ids for sync validation (static catalog + common Realtime voices). */
export function isKnownInworldVoice(voiceId: string): boolean {
  const trimmed = voiceId.trim();
  if (!isValidInworldVoice(trimmed)) return false;
  if (INWORLD_VOICES.some((v) => v.id === trimmed)) return true;
  const extras = ["Clive", "Ash", "Ashley", "Dennis", "Mark", "Edward", "Olivia", "Elizabeth", "Theodore"];
  return extras.includes(trimmed);
}

/** Normalize voice id before session start; falls back to default when missing or invalid. */
export function resolveInworldVoiceId(voiceId: string | null | undefined): string {
  const trimmed = (voiceId ?? "").trim();
  if (!isValidInworldVoice(trimmed)) return DEFAULT_INWORLD_VOICE;
  return trimmed;
}
