import { ok, fail } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { getCherryVoiceSettingsByToken } from "@/lib/repositories/cherry-voice";
import { endCherryVoiceRealtimeSession } from "@/lib/voice/realtime-session";
import { getVoiceSession } from "@/lib/voice/session-store";
import {
  cherryVoiceFail,
  cherryVoiceJson,
  cherryVoiceOptionsResponse,
  resolveWidgetToken,
} from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizeEnd(
  req: Request,
  sessionId: string,
  widgetToken: string | null,
): Promise<Response | null> {
  const session = getVoiceSession(sessionId);
  if (!session) return fail("Session not found", 404);

  if (widgetToken) {
    const settings = await getCherryVoiceSettingsByToken(widgetToken);
    if (!settings || settings.restaurantId !== session.restaurantId) {
      return cherryVoiceFail("Invalid widget token", 401);
    }
    return null;
  }

  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  if (session.restaurantId !== restaurantId) return fail("Session not found", 404);
  return null;
}

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** POST /api/cherry-voice/realtime/session/[id]/end — finalize call log and tear down session */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await ctx.params;
    const widgetToken = resolveWidgetToken(req);
    const authErr = await authorizeEnd(req, sessionId, widgetToken);
    if (authErr) {
      if (widgetToken && authErr.status === 404) return cherryVoiceFail("Session not found", 404);
      return authErr;
    }

    await endCherryVoiceRealtimeSession(sessionId);

    if (widgetToken) {
      return cherryVoiceJson({ ok: true, data: { ended: true } });
    }
    return ok({ ended: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
