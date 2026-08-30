import { z } from "zod";
import { env } from "@/lib/env";
import { readJson } from "@/lib/http";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getCherryVoiceSettingsByToken } from "@/lib/repositories/cherry-voice";
import { resolveRestaurantSttLocale } from "@/lib/voice/deepgram-locale";
import { isCherryVoiceConfigured } from "@/lib/voice/config";
import { startVoiceOrchestrator } from "@/lib/voice/orchestrator";
import { createVoiceSession } from "@/lib/voice/session-store";
import {
  cherryVoiceFail,
  cherryVoiceJson,
  cherryVoiceOptionsResponse,
  resolveWidgetToken,
} from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().optional(),
  widget_token: z.string().optional(),
});

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** POST /api/cherry-voice/session — start a browser voice session */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`cherry-voice-session:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return cherryVoiceFail("Rate limit exceeded", 429);
  }

  if (!(await isCherryVoiceConfigured())) {
    return cherryVoiceFail("Cherry Voice is not configured on this server", 503);
  }

  const body = await readJson(req);
  const parsed = bodySchema.safeParse(body ?? {});
  const token = resolveWidgetToken(req, parsed.success ? parsed.data : undefined);
  if (!token) {
    return cherryVoiceFail("Missing widget token", 401);
  }

  const settings = await getCherryVoiceSettingsByToken(token);
  if (!settings) {
    return cherryVoiceFail("Invalid widget token", 401);
  }
  if (!settings.isEnabled) {
    return cherryVoiceFail("Voice widget is disabled for this restaurant", 403);
  }

  const sttLocale = await resolveRestaurantSttLocale(settings.restaurantId);
  const branchLabel = settings.branchId ? `Branch #${settings.branchId}` : null;

  const session = createVoiceSession({
    restaurantId: settings.restaurantId,
    voiceId: settings.inworldVoiceId,
    greeting: settings.greeting,
    processingEarconEnabled: settings.processingEarconEnabled,
    postCallSmsEnabled: settings.postCallSmsEnabled,
    branchId: settings.branchId,
    branchLabel,
    sttLocale,
  });

  try {
    await startVoiceOrchestrator(session.id);
  } catch (err) {
    return cherryVoiceFail(`Failed to start voice session: ${(err as Error).message}`, 503);
  }

  const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");
  const edgeBase = env.CHERRY_VOICE_SSE_EDGE_URL?.replace(/\/$/, "");
  const eventsPath = `/api/cherry-voice/session/${session.id}/events`;
  const eventsUrl = edgeBase ? `${edgeBase}${eventsPath}` : `${baseUrl}${eventsPath}`;

  return cherryVoiceJson(
    {
      ok: true,
      data: {
        session_id: session.id,
        restaurant: {
          id: settings.restaurantId,
          name: settings.restaurantName,
          slug: settings.restaurantSlug,
        },
        events_url: eventsUrl,
        audio_url: `${baseUrl}/api/cherry-voice/session/${session.id}/audio`,
        control_url: `${baseUrl}/api/cherry-voice/session/${session.id}/control`,
        processing_earcon_enabled: settings.processingEarconEnabled,
      },
    },
    { status: 201 },
  );
}
