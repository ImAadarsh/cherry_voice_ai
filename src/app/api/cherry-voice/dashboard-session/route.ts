import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { listAgents } from "@/lib/repositories/agents";
import { getCherryVoiceSettingsByRestaurant } from "@/lib/repositories/cherry-voice";
import { env } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveRestaurantSttLocale } from "@/lib/voice/deepgram-locale";
import { isCherryVoiceConfigured } from "@/lib/voice/config";
import { startVoiceOrchestrator } from "@/lib/voice/orchestrator";
import { createVoiceSession } from "@/lib/voice/session-store";
import { normalizePersonalityPreset } from "@/lib/voice/personality";
import { resolveInworldVoiceId } from "@/lib/voice/inworld-voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  agent_id: z.string().optional(),
});

/** POST /api/cherry-voice/dashboard-session — authenticated browser voice session */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`cherry-voice-dashboard:${ip}`, 30, 60_000);
    if (!rate.allowed) return fail("Rate limit exceeded", 429);

    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;

    if (!(await isCherryVoiceConfigured())) {
      return fail("Cherry Voice is not configured on this server", 503);
    }

    const settings = await getCherryVoiceSettingsByRestaurant(restaurantId);
    if (!settings) return fail("Cherry Voice settings not found", 404);

    const body = await readJson(req);
    const parsed = bodySchema.safeParse(body ?? {});

    let voiceId = settings.inworldVoiceId;
    let greeting = settings.greeting;
    let agentDbId: number | null = null;
    let personalityPreset = normalizePersonalityPreset("warm");

    if (parsed.success && parsed.data.agent_id) {
      const agents = await listAgents(restaurantId);
      const agent = agents.find((a) => a.omnidim_agent_id === parsed.data.agent_id);
      if (agent && String(agent.agent_type ?? "platform") === "native") {
        agentDbId = agent.id;
        if (agent.voice_id) voiceId = String(agent.voice_id);
        const config =
          agent.config && typeof agent.config === "object"
            ? (agent.config as Record<string, unknown>)
            : agent.config
              ? (JSON.parse(String(agent.config)) as Record<string, unknown>)
              : {};
        if (typeof config.welcome_message === "string" && config.welcome_message.trim()) {
          greeting = config.welcome_message.trim();
        }
        personalityPreset = normalizePersonalityPreset(config.personality_preset);
      }
    }

    const sttLocale = await resolveRestaurantSttLocale(settings.restaurantId);
    const branchLabel = settings.branchId ? `Branch #${settings.branchId}` : null;

    const session = createVoiceSession({
      restaurantId: settings.restaurantId,
      voiceId: resolveInworldVoiceId(voiceId),
      greeting,
      agentId: agentDbId,
      processingEarconEnabled: settings.processingEarconEnabled,
      postCallSmsEnabled: settings.postCallSmsEnabled,
      branchId: settings.branchId,
      branchLabel,
      sttLocale,
    });

    try {
      await startVoiceOrchestrator(session.id);
    } catch (err) {
      return fail(`Failed to start voice session: ${(err as Error).message}`, 503);
    }

    const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");
    const edgeBase = env.CHERRY_VOICE_SSE_EDGE_URL?.replace(/\/$/, "");
    const eventsPath = `/api/cherry-voice/session/${session.id}/events`;
    const eventsUrl = edgeBase ? `${edgeBase}${eventsPath}` : `${baseUrl}${eventsPath}`;

    return ok(
      {
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
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
