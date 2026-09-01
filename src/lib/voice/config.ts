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
    "gemini-3.5-flash-lite"
  ).trim();
}

export async function getCherryVoiceSttModel(): Promise<string> {
  return (env.CHERRY_VOICE_STT_MODEL || "nova-3").trim();
}

export async function getCherryVoiceTtsModel(): Promise<string> {
  return (env.CHERRY_VOICE_TTS_MODEL || "inworld-tts-2-flash").trim();
}

export type CherryVoiceLlmProviderKind = "gemini" | "inworld";

export async function getCherryVoiceLlmProvider(): Promise<CherryVoiceLlmProviderKind> {
  const fromDb = await getPlatformSetting<string>("cherry_voice_llm_provider");
  const raw = (fromDb?.trim() || env.CHERRY_VOICE_LLM_PROVIDER || "inworld").trim().toLowerCase();
  return raw === "gemini" ? "gemini" : "inworld";
}

export async function getInworldRouterModel(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("inworld_router_model");
  return (
    fromDb?.trim() ||
    env.INWORLD_ROUTER_MODEL ||
    "inworld/models/gemma-4-26b-a4b-it"
  ).trim();
}

export async function getCherryVoiceMode(): Promise<"inworld_realtime" | "pipeline"> {
  const { getCherryVoiceMode: resolveMode } = await import("./realtime-config");
  return resolveMode();
}

/** Realtime mode only needs Inworld API key (unified STT+LLM+TTS). */
export async function isCherryVoiceRealtimeConfigured(): Promise<boolean> {
  const iw = await getInworldApiKey();
  return iw.length > 0;
}

export async function isCherryVoiceConfigured(): Promise<boolean> {
  const mode = await getCherryVoiceMode();
  if (mode === "inworld_realtime") {
    return isCherryVoiceRealtimeConfigured();
  }

  const [dg, iw, llmProvider] = await Promise.all([
    getDeepgramApiKey(),
    getInworldApiKey(),
    getCherryVoiceLlmProvider(),
  ]);
  if (!dg || !iw) return false;
  if (llmProvider === "gemini") {
    const gemini = await import("@/lib/platform-config").then((m) => m.getGeminiApiKey());
    return gemini.length > 0;
  }
  return true;
}
