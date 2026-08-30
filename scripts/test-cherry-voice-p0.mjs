#!/usr/bin/env node
/**
 * Static smoke checks for Cherry Voice P0 features.
 * Run: node scripts/test-cherry-voice-p0.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

const checks = [];
function assert(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

const inworldTts = read("src/lib/voice/providers/inworld-tts.ts");
const orchestrator = read("src/lib/voice/orchestrator.ts");
const fillerPhrases = read("src/lib/voice/filler-phrases.ts");
const callLog = read("src/lib/voice/call-log.ts");
const eventsRoute = read("src/app/api/cherry-voice/session/[id]/events/route.ts");
const webCallPanel = read("src/components/cherry-voice/web-call-panel.tsx");
const clientAudio = read("src/lib/voice/client-audio.ts");
const widgetJs = read("public/widget/cherry-voice.js");
const widgetCss = read("public/widget/cherry-voice.css");
const tools = read("src/lib/voice/tools.ts");

assert("WAV strip in inworld-tts", /stripWavHeader/.test(inworldTts));
assert("PCM encoding emitted", /encoding:\s*"pcm_s16le"/.test(orchestrator));
assert("AudioContext resume in web-call-panel", /ensureContext\(\)/.test(webCallPanel));
assert("AudioContext resume in widget", /playbackContext\.resume/.test(widgetJs));
assert("Tool filler before tools", /getToolFillerPhrase/.test(orchestrator) && /speakResponse\(session, filler/.test(orchestrator));

const toolNames = [...tools.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
const missingFillers = toolNames.filter(
  (name) => !fillerPhrases.includes(`${name}:`) && !new RegExp(`${name}:`).test(fillerPhrases),
);
assert(
  "EN/HI fillers for all tools",
  missingFillers.length === 0,
  missingFillers.length ? `missing: ${missingFillers.join(", ")}` : `${toolNames.length} tools`,
);

assert("Barge-in server interrupt", /interruptSpeech/.test(orchestrator));
assert("Barge-in queued utterance", /const queued = session\.pendingUtterance\.trim\(\)/.test(orchestrator));
assert("Barge-in client stop playback", /stopPlayback\(\)/.test(webCallPanel) && /stopPlayback\(\)/.test(widgetJs));
assert("tts_error logging", /name:\s*"tts_error"/.test(callLog));
assert("TTS retry before fallback", /synthesizeWithChunks\(session, text\)[\s\S]*synthesizeWithChunks\(session, text\)/.test(orchestrator));
assert("TTS spoken fallback phrase", /getTtsFallbackPhrase/.test(orchestrator));
assert("Silence prompt 45s", /SILENCE_PROMPT_AFTER_MS\s*=\s*45_000/.test(orchestrator));
assert("Silence anti-stack", /lastSilencePromptAt/.test(orchestrator));
assert("SSE keepalive 15s", /KEEPALIVE_MS\s*=\s*15_000/.test(eventsRoute));
assert("Widget SSE reconnect", /MAX_RECONNECT_ATTEMPTS/.test(widgetJs) && /connectEvents\(state\.session\)/.test(widgetJs));
assert("Thinking UI in web-call-panel", /Thinking…/.test(webCallPanel) && /animate-pulse/.test(webCallPanel));
assert("Thinking UI in widget", /Thinking…/.test(widgetJs) && /\.thinking/.test(widgetCss));
assert("Client WAV strip fallback", /stripWavHeaderClient/.test(clientAudio));

const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} P0 check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} Cherry Voice P0 smoke checks passed.`);
