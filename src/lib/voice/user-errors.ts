/** Map raw provider errors to a single user-friendly message (no stack traces). */

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
