import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getCherryVoiceSettingsByToken } from "@/lib/repositories/cherry-voice";
import {
  logCherryVoiceToolCall,
  logCherryVoiceTranscript,
} from "@/lib/voice/call-log";
import { executeCherryVoiceTool } from "@/lib/voice/tools";
import { updateConversationMemoryFromTool } from "@/lib/voice/system-prompt";
import { getVoiceSession, setSessionState, touchSession } from "@/lib/voice/session-store";
import {
  cherryVoiceFail,
  cherryVoiceJson,
  cherryVoiceOptionsResponse,
  resolveWidgetToken,
} from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  call_id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.union([z.string(), z.record(z.unknown())]).optional(),
  token: z.string().optional(),
  widget_token: z.string().optional(),
});

function parseToolArgs(raw: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function authorizeToolCall(
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

/** POST /api/cherry-voice/realtime/session/[id]/tools — execute Realtime function_call */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await ctx.params;
    const ip = getClientIp(req);
    const rate = checkRateLimit(`cherry-voice-realtime-tools:${ip}`, 120, 60_000);
    if (!rate.allowed) return fail("Rate limit exceeded", 429);

    const body = await readJson(req);
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) return fail("Invalid tool payload", 422);

    const widgetToken = resolveWidgetToken(req, parsed.data);
    const auth = await authorizeToolCall(req, sessionId, widgetToken);
    if (auth instanceof Response) {
      if (widgetToken && auth.status === 404) return cherryVoiceFail("Session not found", 404);
      return auth;
    }

    const { session } = auth;
    touchSession(session);

    const args = parseToolArgs(parsed.data.arguments);
    const toolName = parsed.data.name;

    setSessionState(session, "tool_running");

    const result = await executeCherryVoiceTool(session.restaurantId, toolName, args, session);
    updateConversationMemoryFromTool(session, toolName, args, result);

    await logCherryVoiceToolCall(session, toolName, args, result);
    await logCherryVoiceTranscript(
      session,
      "assistant",
      `[tool:${toolName}] ${result.ok ? "ok" : result.error ?? "failed"}`,
    );

    setSessionState(session, "listening");

    const output = JSON.stringify(result.ok ? result.data ?? { ok: true } : { error: result.error });

    const payload = {
      call_id: parsed.data.call_id,
      output,
      ok: result.ok,
    };

    if (widgetToken) {
      return cherryVoiceJson({ ok: true, data: payload });
    }
    return ok(payload);
  } catch (err) {
    return handleRouteError(err);
  }
}
