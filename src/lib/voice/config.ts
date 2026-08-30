import "server-only";
import { env } from "@/lib/env";
import { getPlatformSetting } from "@/lib/repositories/platform-settings";

export async function getDeepgramApiKey(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("deepgram_api_key");
  return (fromDb?.trim() || env.DEEPGRAM_API_KEY || "").trim();
}

export async function getInworldApiKey(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("inworld_api_key");
  return (fromDb?.trim() || env.INWORLD_API_KEY || "").trim();
}

export async function getCherryVoiceGeminiModel(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("cherry_voice_gemini_model");
  return (
    fromDb?.trim() ||
    env.CHERRY_VOICE_GEMINI_MODEL ||
    env.GEMINI_MODEL ||
    "gemini-2.0-flash-lite"
  ).trim();
}

export async function getCherryVoiceSttModel(): Promise<string> {
  return (env.CHERRY_VOICE_STT_MODEL || "nova-3").trim();
}

export async function getCherryVoiceTtsModel(): Promise<string> {
  return (env.CHERRY_VOICE_TTS_MODEL || "inworld-tts-2-flash").trim();
}

export async function isCherryVoiceConfigured(): Promise<boolean> {
  const [dg, iw, gemini] = await Promise.all([
    getDeepgramApiKey(),
    getInworldApiKey(),
    import("@/lib/platform-config").then((m) => m.getGeminiApiKey()),
  ]);
  return dg.length > 0 && iw.length > 0 && gemini.length > 0;
}
