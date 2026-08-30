/** Shared Inworld voice catalog (safe for client + server imports). */
export interface InworldVoiceOption {
  id: string;
  label: string;
  description?: string;
}

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

export function isValidInworldVoice(voiceId: string): boolean {
  return INWORLD_VOICES.some((v) => v.id === voiceId);
}
