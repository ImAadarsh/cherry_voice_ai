import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { getCherryVoiceSettingsByToken } from "@/lib/repositories/cherry-voice";
import { logCherryVoiceTranscript } from "@/lib/voice/call-log";
import { getVoiceSession, touchSession } from "@/lib/voice/session-store";
import {
  cherryVoiceFail,
  cherryVoiceJson,
  cherryVoiceOptionsResponse,
  resolveWidgetToken,
} from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1),
  token: z.string().optional(),
  widget_token: z.string().optional(),
});

async function authorizeTranscript(
  req: Request,
  sessionId: string,
  widgetToken: string | null,
): Promise<{ session: NonNullable<ReturnType<typeof getVoiceSession>> } | Response> {
  const session = getVoiceSession(sessionId);
  if (!session) return fail("Session not found", 404);

  if (widgetToken) {
    const settings = await getCherryVoiceSettingsByToken(widgetToken);
    if (!settings || settings.restaurantId !== session.restaurantId) {
      return cherryVoiceFail("Invalid widget token", 401);
    }
    return { session };
  }

  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  if (session.restaurantId !== restaurantId) return fail("Session not found", 404);
  return { session };
}

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** POST /api/cherry-voice/realtime/session/[id]/transcript — append transcript line to call log */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await ctx.params;
    const body = await readJson(req);
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) return fail("Invalid transcript payload", 422);

    const widgetToken = resolveWidgetToken(req, parsed.data);
    const auth = await authorizeTranscript(req, sessionId, widgetToken);
    if (auth instanceof Response) {
      if (widgetToken && auth.status === 404) return cherryVoiceFail("Session not found", 404);
      return auth;
    }

    const { session } = auth;
    touchSession(session);
    await logCherryVoiceTranscript(session, parsed.data.role, parsed.data.text);

    if (widgetToken) return cherryVoiceJson({ ok: true, data: { logged: true } });
    return ok({ logged: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
