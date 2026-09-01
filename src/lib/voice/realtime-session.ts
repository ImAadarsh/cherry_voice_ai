import "server-only";
import { listAgents } from "@/lib/repositories/agents";
import { getCherryVoiceSettingsByRestaurant, getCherryVoiceSettingsByToken } from "@/lib/repositories/cherry-voice";
import { listCategories, listMenuItems } from "@/lib/repositories/menu";
import { getRestaurant } from "@/lib/repositories/settings";
import { resolveRestaurantSttLocale } from "@/lib/voice/deepgram-locale";
import { resolveInworldVoiceIdForRealtime } from "@/lib/voice/inworld-voice-resolve";
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
  customPrompt?: string;
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

  const customPrompt =
    typeof config.prompt === "string" && config.prompt.trim() ? config.prompt.trim() : undefined;

  return {
    agentDbId: agent.id,
    voiceId: agent.voice_id ? String(agent.voice_id) : undefined,
    greeting:
      typeof config.welcome_message === "string" && config.welcome_message.trim()
        ? config.welcome_message.trim()
        : undefined,
    customPrompt,
    personalityPreset: normalizePersonalityPreset(config.personality_preset),
  };
}

async function buildMenuHint(restaurantId: number): Promise<string | null> {
  try {
    const [restaurant, categories, items] = await Promise.all([
      getRestaurant(restaurantId),
      listCategories(restaurantId),
      listMenuItems(restaurantId, { available: true, limit: 500 }),
    ]);
    const currency = restaurant?.currency ?? "USD";
    const categoryNames = categories
      .slice(0, 8)
      .map((c) => String((c as { name?: string }).name ?? ""))
      .filter(Boolean);
    if (!items.length && !categoryNames.length) return null;

    const categoryText = categoryNames.length
      ? ` Top categories: ${categoryNames.join(", ")}.`
      : "";
    return `Menu hint: ${items.length} items available, prices in ${currency}.${categoryText} Call get_menu for full menu — never guess items or prices.`;
  } catch {
    return null;
  }
}

async function buildRealtimeInstructions(session: VoiceSessionRecord): Promise<string> {
  const parts = [await buildVoiceSystemPrompt(session)];
  const menuHint = await buildMenuHint(session.restaurantId);
  if (menuHint) parts.push(menuHint);
  return parts.join("\n\n");
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

  const voiceId = await resolveInworldVoiceIdForRealtime(overrides.voiceId ?? settings.inworldVoiceId);

  const session = createVoiceSession({
    restaurantId: settings.restaurantId,
    voiceId,
    greeting: overrides.greeting ?? settings.greeting,
    agentId: overrides.agentDbId ?? null,
    agentCustomPrompt: overrides.customPrompt ?? null,
    personalityPreset: overrides.personalityPreset,
    processingEarconEnabled: settings.processingEarconEnabled,
    postCallSmsEnabled: settings.postCallSmsEnabled,
    branchId: settings.branchId,
    branchLabel,
    sttLocale,
  });

  await initCherryVoiceCallLog(session);
  setSessionState(session, "listening");

  const instructions = await buildRealtimeInstructions(session);
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

export async function rebuildRealtimeSessionConfig(
  sessionId: string,
): Promise<RealtimeSessionConfig | null> {
  const session = getVoiceSession(sessionId);
  if (!session) return null;
  const instructions = await buildRealtimeInstructions(session);
  return buildRealtimeSessionConfig(session, instructions);
}

export async function endCherryVoiceRealtimeSession(sessionId: string): Promise<void> {
  const session = getVoiceSession(sessionId);
  if (!session) return;

  setSessionState(session, "ended");
  await finalizeCherryVoiceCallLog(session);
  deleteVoiceSession(sessionId);
}
