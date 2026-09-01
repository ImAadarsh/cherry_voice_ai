import "server-only";
import { listAgents } from "@/lib/repositories/agents";
import { getCherryVoiceSettingsByRestaurant, getCherryVoiceSettingsByToken } from "@/lib/repositories/cherry-voice";
import { resolveRestaurantSttLocale } from "@/lib/voice/deepgram-locale";
import { resolveInworldVoiceId } from "@/lib/voice/inworld-voices";
import { normalizePersonalityPreset } from "@/lib/voice/personality";
import { buildVoiceSystemPrompt } from "@/lib/voice/system-prompt";
import { initCherryVoiceCallLog, finalizeCherryVoiceCallLog } from "./call-log";
import {
  buildRealtimeSessionConfig,
  fetchInworldIceServers,
  getInworldRealtimeCallsUrl,
  type RealtimeSessionConfig,
} from "./realtime-config";
import {
  createVoiceSession,
  deleteVoiceSession,
  getVoiceSession,
  setSessionState,
  type VoiceSessionRecord,
} from "./session-store";

export type RealtimeSessionBootstrap = {
  session: VoiceSessionRecord;
  sessionConfig: RealtimeSessionConfig;
  iceServers: import("./realtime-config").IceServerConfig[];
  callsUrl: string;
  greeting: string | null;
};

export async function resolveNativeAgentOverrides(
  restaurantId: number,
  agentOmnidimId?: string,
): Promise<{
  voiceId?: string;
  greeting?: string;
  agentDbId?: number;
  personalityPreset?: ReturnType<typeof normalizePersonalityPreset>;
}> {
  if (!agentOmnidimId) return {};

  const agents = await listAgents(restaurantId);
  const agent = agents.find((a) => a.omnidim_agent_id === agentOmnidimId);
  if (!agent || String(agent.agent_type ?? "platform") !== "native") return {};

  const config =
    agent.config && typeof agent.config === "object"
      ? (agent.config as Record<string, unknown>)
      : agent.config
        ? (JSON.parse(String(agent.config)) as Record<string, unknown>)
        : {};

  return {
    agentDbId: agent.id,
    voiceId: agent.voice_id ? String(agent.voice_id) : undefined,
    greeting:
      typeof config.welcome_message === "string" && config.welcome_message.trim()
        ? config.welcome_message.trim()
        : undefined,
    personalityPreset: normalizePersonalityPreset(config.personality_preset),
  };
}

export async function createCherryVoiceRealtimeSession(input: {
  restaurantId: number;
  agentId?: string;
}): Promise<RealtimeSessionBootstrap> {
  const settings = await getCherryVoiceSettingsByRestaurant(input.restaurantId);
  if (!settings) {
    throw new Error("Cherry Voice settings not found");
  }

  const overrides = await resolveNativeAgentOverrides(settings.restaurantId, input.agentId);
  const sttLocale = await resolveRestaurantSttLocale(settings.restaurantId);
  const branchLabel = settings.branchId ? `Branch #${settings.branchId}` : null;

  const session = createVoiceSession({
    restaurantId: settings.restaurantId,
    voiceId: resolveInworldVoiceId(overrides.voiceId ?? settings.inworldVoiceId),
    greeting: overrides.greeting ?? settings.greeting,
    agentId: overrides.agentDbId ?? null,
    processingEarconEnabled: settings.processingEarconEnabled,
    postCallSmsEnabled: settings.postCallSmsEnabled,
    branchId: settings.branchId,
    branchLabel,
    sttLocale,
  });

  await initCherryVoiceCallLog(session);
  setSessionState(session, "listening");

  const instructions = await buildVoiceSystemPrompt(session);
  const sessionConfig = await buildRealtimeSessionConfig(session, instructions);
  const iceServers = await fetchInworldIceServers();

  return {
    session,
    sessionConfig,
    iceServers,
    callsUrl: getInworldRealtimeCallsUrl(),
    greeting: session.greeting,
  };
}

export async function createCherryVoiceRealtimeWidgetSession(
  widgetToken: string,
): Promise<RealtimeSessionBootstrap> {
  const settings = await getCherryVoiceSettingsByToken(widgetToken);
  if (!settings) {
    throw new Error("Invalid widget token");
  }
  if (!settings.isEnabled) {
    throw new Error("Voice widget is disabled for this restaurant");
  }

  return createCherryVoiceRealtimeSession({ restaurantId: settings.restaurantId });
}

export async function endCherryVoiceRealtimeSession(sessionId: string): Promise<void> {
  const session = getVoiceSession(sessionId);
  if (!session) return;

  setSessionState(session, "ended");
  await finalizeCherryVoiceCallLog(session);
  deleteVoiceSession(sessionId);
}
