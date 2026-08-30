import "server-only";
import { env } from "./env";
import { getPlatformSetting } from "./repositories/platform-settings";

/** Resolve Omnidim API key: platform_settings first, then .env fallback. */
export async function getOmnidimApiKey(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("omnidim_api_key");
  const key = (fromDb?.trim() || env.OMNIDIM_API_KEY || "").trim();
  return key;
}

/** Resolve Omnidim webhook secret: platform_settings first, then .env fallback. */
export async function getOmnidimWebhookSecret(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("omnidim_webhook_secret");
  return (fromDb?.trim() || env.OMNIDIM_WEBHOOK_SECRET || "").trim();
}

/** Resolve Gemini API key: platform_settings first, then .env fallback. */
export async function getGeminiApiKey(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("gemini_api_key");
  return (fromDb?.trim() || env.GEMINI_API_KEY || "").trim();
}

/** Resolve Gemini model name: platform_settings first, then .env fallback. */
export async function getGeminiModel(): Promise<string> {
  const fromDb = await getPlatformSetting<string>("gemini_model");
  return (fromDb?.trim() || env.GEMINI_MODEL || "gemini-3.6-flash").trim();
}

/** Resolve default voice provider slug from platform settings. */
export async function getDefaultVoiceProvider(): Promise<string | null> {
  const fromDb = await getPlatformSetting<string>("default_voice_provider");
  return fromDb?.trim() || null;
}

export async function isOmnidimConfigured(): Promise<boolean> {
  return (await getOmnidimApiKey()).length > 0;
}

export async function isGeminiConfigured(): Promise<boolean> {
  return (await getGeminiApiKey()).length > 0;
}
