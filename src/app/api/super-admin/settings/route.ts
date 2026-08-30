import { ok } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { handleRouteError } from "@/lib/api-error";
import {
  getPlatformSettingsPublic,
  maskSecret,
  getPlatformSetting,
} from "@/lib/repositories/platform-settings";
import { getGeminiModel, isGeminiConfigured, isOmnidimConfigured } from "@/lib/platform-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/super-admin/settings — legacy alias; prefer /api/super-admin/platform-settings */
export async function GET(req: Request) {
  try {
    const session = await requireSuperAdmin(req);
    if (session instanceof Response) return session;

    const settings = await getPlatformSettingsPublic();
    const omnidimKey = await getPlatformSetting<string>("omnidim_api_key");
    const geminiKey = await getPlatformSetting<string>("gemini_api_key");
    const omnidimConfigured = await isOmnidimConfigured();
    const geminiConfigured = await isGeminiConfigured();
    const geminiModel = await getGeminiModel();

    return ok({
      voiceAi: {
        label: "Voice AI Platform API Key",
        configured: omnidimConfigured,
        masked: maskSecret(omnidimKey).hint,
        source: omnidimKey ? "platform_settings" : "environment",
      },
      gemini: {
        label: "Gemini API Key",
        configured: geminiConfigured,
        masked: maskSecret(geminiKey).hint,
        model: geminiModel,
        source: geminiKey ? "platform_settings" : "environment",
      },
      settings,
      defaults: {
        voiceProvider: settings.default_voice_provider ?? "voice_ai_platform",
        defaultLanguage: "en-US",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
