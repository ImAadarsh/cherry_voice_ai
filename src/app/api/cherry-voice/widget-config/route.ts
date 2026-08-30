import {
  getCherryVoiceSettingsBySlug,
  getCherryVoiceSettingsByToken,
} from "@/lib/repositories/cherry-voice";
import { isCherryVoiceConfigured } from "@/lib/voice/config";
import { INWORLD_VOICES } from "@/lib/voice/inworld-voices";
import { cherryVoiceFail, cherryVoiceJson, cherryVoiceOptionsResponse } from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** GET /api/cherry-voice/widget-config — public widget bootstrap config */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? url.searchParams.get("widget_token");
  const restaurant = url.searchParams.get("restaurant");

  let settings = token ? await getCherryVoiceSettingsByToken(token) : null;
  if (!settings && restaurant) {
    settings = await getCherryVoiceSettingsBySlug(restaurant);
  }

  if (!settings) {
    return cherryVoiceFail("Widget not found", 404);
  }

  const configured = await isCherryVoiceConfigured();

  return cherryVoiceJson({
    ok: true,
    data: {
      restaurant: {
        name: settings.restaurantName,
        slug: settings.restaurantSlug,
      },
      voice_id: settings.inworldVoiceId,
      position: settings.widgetPosition,
      accent_color: settings.accentColor,
      greeting: settings.greeting,
      is_enabled: settings.isEnabled && configured,
      voices: INWORLD_VOICES.map((v) => ({ id: v.id, label: v.label })),
    },
  });
}
