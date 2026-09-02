import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { env } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getCherryVoiceSettingsByRestaurant } from "@/lib/repositories/cherry-voice";
import { isCherryVoiceRealtimeConfigured, getCherryVoiceRealtimeToolsEnabled } from "@/lib/voice/config";
import {
  createCherryVoiceRealtimeSession,
  createCherryVoiceRealtimeWidgetSession,
} from "@/lib/voice/realtime-session";
import {
  cherryVoiceFail,
  cherryVoiceJson,
  cherryVoiceOptionsResponse,
  resolveWidgetToken,
} from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  agent_id: z.string().optional(),
  token: z.string().optional(),
  widget_token: z.string().optional(),
});

/** POST /api/cherry-voice/realtime/session — bootstrap Inworld Realtime WebRTC session */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`cherry-voice-realtime-session:${ip}`, 30, 60_000);
    if (!rate.allowed) return fail("Rate limit exceeded", 429);

    if (!(await isCherryVoiceRealtimeConfigured())) {
      return fail("Cherry Voice Realtime is not configured (INWORLD_API_KEY missing)", 503);
    }

    const body = await readJson(req);
    const parsed = bodySchema.safeParse(body ?? {});

    const widgetToken = resolveWidgetToken(req, parsed.success ? parsed.data : undefined);
    const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");

    let bootstrap;
    let restaurantMeta: { id: number; name: string; slug: string } | undefined;

    if (widgetToken) {
      bootstrap = await createCherryVoiceRealtimeWidgetSession(widgetToken);
      const settings = await import("@/lib/repositories/cherry-voice").then((m) =>
        m.getCherryVoiceSettingsByToken(widgetToken),
      );
      if (settings) {
        restaurantMeta = {
          id: settings.restaurantId,
          name: settings.restaurantName,
          slug: settings.restaurantSlug,
        };
      }
    } else {
      const restaurantId = await requireRestaurantId(req);
      if (restaurantId instanceof Response) return restaurantId;

      const settings = await getCherryVoiceSettingsByRestaurant(restaurantId);
      if (!settings) return fail("Cherry Voice settings not found", 404);

      bootstrap = await createCherryVoiceRealtimeSession({
        restaurantId,
        agentId: parsed.success ? parsed.data.agent_id : undefined,
      });
      restaurantMeta = {
        id: settings.restaurantId,
        name: settings.restaurantName,
        slug: settings.restaurantSlug,
      };
    }

    const { session, sessionConfig, iceServers, callsUrl, greeting } = bootstrap;

    const toolsEnabled = await getCherryVoiceRealtimeToolsEnabled();

    const payload = {
      session_id: session.id,
      mode: "inworld_realtime" as const,
      tools_enabled: toolsEnabled,
      restaurant: restaurantMeta,
      ice_servers: iceServers,
      calls_url: callsUrl,
      sdp_proxy_url: `${baseUrl}/api/cherry-voice/realtime/calls`,
      tools_url: `${baseUrl}/api/cherry-voice/realtime/session/${session.id}/tools`,
      transcript_url: `${baseUrl}/api/cherry-voice/realtime/session/${session.id}/transcript`,
      end_url: `${baseUrl}/api/cherry-voice/realtime/session/${session.id}/end`,
      session_config: sessionConfig,
      greeting,
      processing_earcon_enabled: session.processingEarconEnabled,
    };

    if (widgetToken) {
      return cherryVoiceJson({ ok: true, data: payload }, { status: 201 });
    }

    return ok(payload, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}
