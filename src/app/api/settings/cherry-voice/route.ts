import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import {
  ensureCherryVoiceSettings,
  getCherryVoiceSettingsByRestaurant,
  updateCherryVoiceSettings,
} from "@/lib/repositories/cherry-voice";
import { isCherryVoiceConfigured } from "@/lib/voice/config";
import { INWORLD_VOICES, isValidInworldVoice } from "@/lib/voice/inworld-voices";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  inworld_voice_id: z.string().optional(),
  agent_id: z.number().nullable().optional(),
  greeting: z.string().nullable().optional(),
  widget_position: z.enum(["bottom-right", "bottom-left"]).optional(),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_enabled: z.boolean().optional(),
});

/** GET /api/settings/cherry-voice */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  await ensureCherryVoiceSettings(restaurantId);
  const settings = await getCherryVoiceSettingsByRestaurant(restaurantId);
  if (!settings) return fail("Cherry voice settings not found", 404);

  const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");
  const embedScript = `<script src="${baseUrl}/widget/cherry-voice.js" data-token="${settings.widgetToken}" data-restaurant="${settings.restaurantSlug}"></script>`;

  return ok({
    settings,
    voices: INWORLD_VOICES,
    configured: await isCherryVoiceConfigured(),
    embed_script: embedScript,
    demo_url: `${baseUrl}/demo/cherry-voice?token=${encodeURIComponent(settings.widgetToken)}`,
  });
}

/** PATCH /api/settings/cherry-voice */
export async function PATCH(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  if (parsed.data.inworld_voice_id && !isValidInworldVoice(parsed.data.inworld_voice_id)) {
    return fail("Invalid Inworld voice", 422);
  }

  const updated = await updateCherryVoiceSettings(restaurantId, {
    inworldVoiceId: parsed.data.inworld_voice_id,
    agentId: parsed.data.agent_id,
    greeting: parsed.data.greeting,
    widgetPosition: parsed.data.widget_position,
    accentColor: parsed.data.accent_color,
    isEnabled: parsed.data.is_enabled,
  });

  return ok({ settings: updated });
}
