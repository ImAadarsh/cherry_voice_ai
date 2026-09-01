import "server-only";
import { listInworldVoices } from "./inworld-api";
import {
  DEFAULT_INWORLD_VOICE,
  INWORLD_VOICES,
  isKnownInworldVoice,
  isValidInworldVoice,
} from "./inworld-voices";

let cachedVoiceIds: Set<string> | null = null;

/** Validate against Inworld API voice list; fallback to Sarah when unknown (e.g. Omnidim ids). */
export async function resolveInworldVoiceIdForRealtime(
  voiceId: string | null | undefined,
): Promise<string> {
  const trimmed = (voiceId ?? "").trim();
  if (!isValidInworldVoice(trimmed)) return DEFAULT_INWORLD_VOICE;
  if (isKnownInworldVoice(trimmed)) return trimmed;

  if (!cachedVoiceIds) {
    try {
      const voices = await listInworldVoices();
      cachedVoiceIds = new Set([
        ...INWORLD_VOICES.map((v) => v.id),
        ...voices.map((v) => v.voiceId),
      ]);
    } catch {
      cachedVoiceIds = new Set(INWORLD_VOICES.map((v) => v.id));
    }
  }

  if (cachedVoiceIds.has(trimmed)) return trimmed;

  console.warn(
    `[Cherry Voice Realtime] Unknown Inworld voice "${trimmed}" — falling back to ${DEFAULT_INWORLD_VOICE}`,
  );
  return DEFAULT_INWORLD_VOICE;
}
