import { z } from "zod";
import { fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isCherryVoiceRealtimeConfigured } from "@/lib/voice/config";
import { proxyInworldSdpOffer, type RealtimeSessionConfig } from "@/lib/voice/realtime-config";
import { getVoiceSession } from "@/lib/voice/session-store";
import { rebuildRealtimeSessionConfig } from "@/lib/voice/realtime-session";
import {
  cherryVoiceFail,
  cherryVoiceOptionsResponse,
  resolveWidgetToken,
} from "@/lib/voice/widget-auth";
import { getCherryVoiceSettingsByToken } from "@/lib/repositories/cherry-voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sdp: z.string().min(1),
  session_id: z.string().optional(),
  session_config: z.record(z.unknown()).optional(),
  token: z.string().optional(),
  widget_token: z.string().optional(),
});

async function authorizeRealtimeCall(req: Request, sessionId?: string, widgetToken?: string | null): Promise<Response | null> {
  if (widgetToken) {
    const settings = await getCherryVoiceSettingsByToken(widgetToken);
    if (!settings) return cherryVoiceFail("Invalid widget token", 401);
    if (sessionId) {
      const session = getVoiceSession(sessionId);
      if (!session || session.restaurantId !== settings.restaurantId) {
        return cherryVoiceFail("Session not found", 404);
      }
    }
    return null;
  }

  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  if (sessionId) {
    const session = getVoiceSession(sessionId);
    if (!session || session.restaurantId !== restaurantId) {
      return fail("Session not found", 404);
    }
  }

  return null;
}

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** POST /api/cherry-voice/realtime/calls — proxy SDP offer to Inworld (keeps API key server-side) */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`cherry-voice-realtime-calls:${ip}`, 60, 60_000);
    if (!rate.allowed) return fail("Rate limit exceeded", 429);

    if (!(await isCherryVoiceRealtimeConfigured())) {
      return fail("Cherry Voice Realtime is not configured", 503);
    }

    const body = await readJson(req);
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) return fail("Invalid payload: sdp required", 422);

    const widgetToken = resolveWidgetToken(req, parsed.data);
    const authErr = await authorizeRealtimeCall(req, parsed.data.session_id, widgetToken);
    if (authErr) return authErr;

    let sessionConfig = parsed.data.session_config as RealtimeSessionConfig | undefined;
    if (parsed.data.session_id) {
      const rebuilt = await rebuildRealtimeSessionConfig(parsed.data.session_id);
      if (rebuilt) sessionConfig = rebuilt;
    }

    const result = await proxyInworldSdpOffer(parsed.data.sdp, sessionConfig);
    if (!result.ok) {
      console.error("[Cherry Voice Realtime] SDP proxy error:", result.status, result.error);
      return fail(result.error, result.status);
    }

    return new Response(result.answerSdp, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
