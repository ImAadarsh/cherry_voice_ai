/** Map raw provider errors to a single user-friendly message (no stack traces). */

export type InworldRealtimeError = {
  type?: string;
  code?: string;
  message?: string;
  param?: string;
  event_id?: string;
};

const INWORLD_PARAM_MESSAGES: Record<string, string> = {
  "session.audio.output.model": "Voice playback model is misconfigured. Contact your administrator.",
  "session.audio.output.voice": "The selected voice is unavailable. Try another agent voice.",
  "session.model": "Voice AI model is misconfigured. Contact your administrator.",
  "session.audio.input.transcription.model": "Speech recognition model is misconfigured. Contact your administrator.",
};

function shortenInworldMessage(message: string | undefined): string {
  const raw = (message ?? "").trim();
  if (!raw) return "";
  const firstLine = raw.split("\n")[0]?.trim() ?? raw;
  return firstLine.length > 220 ? `${firstLine.slice(0, 217)}…` : firstLine;
}

/** Inworld rejects tool registration when billing/plan does not include tool calling. */
export function isInworldToolRestrictionError(error: InworldRealtimeError | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("tool calling") && msg.includes("restricted");
}

/** Log full Inworld Realtime error and return a concise user-facing message. */
export function formatInworldRealtimeError(error: InworldRealtimeError | undefined): string {
  if (!error) return "Something went wrong with the voice call. Please try again.";

  if (isInworldToolRestrictionError(error)) {
    return "Voice works, but menu/order tools need Inworld billing enabled. Add a payment method in the Inworld portal, or set CHERRY_VOICE_REALTIME_TOOLS=false for voice-only calls.";
  }

  console.error("[Cherry Voice Realtime] Inworld error:", {
    type: error.type,
    code: error.code,
    param: error.param,
    message: error.message,
    event_id: error.event_id,
  });

  const detail = shortenInworldMessage(error.message);

  if (error.param && INWORLD_PARAM_MESSAGES[error.param]) {
    return detail ? `${INWORLD_PARAM_MESSAGES[error.param]} (${detail})` : INWORLD_PARAM_MESSAGES[error.param];
  }

  if (error.code === "invalid_value" && error.param) {
    return detail
      ? `Voice AI configuration issue (${error.param}): ${detail}`
      : `Voice AI configuration issue (${error.param}). Contact your administrator.`;
  }

  const prefix = [error.code, error.param].filter(Boolean).join(" · ");
  if (detail) {
    return prefix ? `${prefix}: ${detail}` : detail;
  }

  if (error.type === "invalid_request_error") {
    return "Voice AI rejected the request. Please end the call and try again.";
  }

  return "Something went wrong with the voice call. Please try again.";
}

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  { test: /thought_signature|thoughtSignature/i, message: "Voice AI had a brief hiccup. Please try again." },
  { test: /GoogleGenerativeAI|generativelanguage\.googleapis/i, message: "Voice AI is temporarily unavailable. Please try again in a moment." },
  { test: /GEMINI_API_KEY|API key/i, message: "Voice AI is not fully configured. Contact your administrator." },
  { test: /INWORLD_API_KEY|Inworld TTS/i, message: "Voice playback is unavailable right now. You can still read the transcript." },
  { test: /DEEPGRAM_API_KEY|Deepgram/i, message: "We are having trouble hearing you. Check your microphone and connection." },
  { test: /no audio chunks|TTS returned empty/i, message: "Voice playback failed. Reading the response as text instead." },
  { test: /Session not found|Session ended/i, message: "This call has ended. Start a new call to continue." },
  { test: /AbortError|aborted/i, message: "" },
  { test: /ECONNREFUSED|ETIMEDOUT|network|fetch failed/i, message: "Connection problem. Check your internet and try again." },
];

export function sanitizeVoiceError(raw: string | undefined | null): string {
  const message = (raw ?? "").trim();
  if (!message) return "Something went wrong with the voice call. Please try again.";

  for (const { test, message: friendly } of PATTERNS) {
    if (test.test(message)) {
      return friendly || "";
    }
  }

  if (message.length > 120 || message.includes("\n") || message.includes(" at ")) {
    return "Voice call error. Please end the call and try again.";
  }

  return message;
}

/** One stable key per error class for deduplication in call logs. */
export function voiceErrorDedupKey(kind: "tts" | "stt", raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("disconnect") || m.includes("reconnect")) return `${kind}:stt_reconnect`;
  if (m.includes("thought_signature") || m.includes("thoughtsignature")) return `${kind}:gemini_signature`;
  if (m.includes("inworld")) return `${kind}:inworld`;
  if (m.includes("deepgram")) return `${kind}:deepgram`;
  if (m.includes("no audio")) return `${kind}:no_audio`;
  if (m.includes("api key")) return `${kind}:api_key`;
  return `${kind}:${m.slice(0, 80)}`;
}
