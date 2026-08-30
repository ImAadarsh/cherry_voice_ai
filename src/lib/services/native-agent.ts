import "server-only";
import crypto from "node:crypto";
import { listAgents, upsertAgentMapping, updateAgentMapping } from "@/lib/repositories/agents";
import {
  ensureCherryVoiceSettings,
  getCherryVoiceSettingsByRestaurant,
  updateCherryVoiceSettings,
} from "@/lib/repositories/cherry-voice";
import { updateAgentContext } from "@/lib/repositories/onboarding";
import { generateAgentPrompt } from "@/lib/services/onboarding-extract";

export type NativeAgentConfig = {
  prompt?: string;
  welcome_message?: string;
  widget_position?: "bottom-right" | "bottom-left";
  accent_color?: string;
  is_enabled?: boolean;
};

function generateNativeAgentId(): string {
  return `cv_native_${crypto.randomUUID().replace(/-/g, "")}`;
}

function extractPromptFromBreakdown(
  contextBreakdown?: Array<Record<string, unknown>>,
): string | undefined {
  if (!contextBreakdown?.length) return undefined;
  const instructions = contextBreakdown.find((b) => b.body);
  return instructions?.body ? String(instructions.body) : undefined;
}

export async function createNativeAgent(input: {
  restaurantId: number;
  name: string;
  voiceId?: string | null;
  prompt?: string;
  welcomeMessage?: string;
  contextBreakdown?: Array<Record<string, unknown>>;
  useGeneratedPrompt?: boolean;
  widgetPosition?: "bottom-right" | "bottom-left";
  accentColor?: string;
  isEnabled?: boolean;
  isPrimary?: boolean;
}) {
  const existingAgents = await listAgents(input.restaurantId);
  const prompt =
    input.prompt ??
    extractPromptFromBreakdown(input.contextBreakdown) ??
    (input.useGeneratedPrompt !== false ? await generateAgentPrompt(input.restaurantId) : undefined);

  const nativeId = generateNativeAgentId();
  const config: NativeAgentConfig & Record<string, unknown> = {
    prompt,
    welcome_message: input.welcomeMessage ?? "Thanks for calling! How can I help you today?",
    widget_position: input.widgetPosition ?? "bottom-right",
    accent_color: input.accentColor ?? "#e11d48",
    is_enabled: input.isEnabled ?? true,
    is_primary: input.isPrimary ?? existingAgents.length === 0,
  };

  const localId = await upsertAgentMapping({
    restaurantId: input.restaurantId,
    omnidimAgentId: nativeId,
    name: input.name,
    direction: "inbound",
    voiceId: input.voiceId ?? "Sarah",
    agentType: "native",
    config,
    isPrimary: config.is_primary as boolean,
  });

  await ensureCherryVoiceSettings(input.restaurantId);
  await updateCherryVoiceSettings(input.restaurantId, {
    agentId: localId,
    inworldVoiceId: input.voiceId ?? "Sarah",
    greeting: input.welcomeMessage ?? null,
    widgetPosition: input.widgetPosition,
    accentColor: input.accentColor,
    isEnabled: input.isEnabled,
  });

  if (prompt) {
    await updateAgentContext(input.restaurantId, { generatedPrompt: prompt });
  }

  return { localId, omnidimAgentId: nativeId, config, prompt };
}

export async function updateNativeAgent(
  restaurantId: number,
  localId: number,
  input: {
    name?: string;
    voiceId?: string | null;
    prompt?: string;
    welcomeMessage?: string;
    widgetPosition?: "bottom-right" | "bottom-left";
    accentColor?: string;
    isEnabled?: boolean;
    isPrimary?: boolean;
  },
) {
  const agents = await listAgents(restaurantId);
  const agent = agents.find((a) => Number(a.id) === localId);
  if (!agent || String(agent.agent_type ?? "platform") !== "native") {
    throw new Error("Native agent not found");
  }

  const existingConfig =
    agent.config && typeof agent.config === "object"
      ? { ...(agent.config as Record<string, unknown>) }
      : agent.config
        ? (JSON.parse(String(agent.config)) as Record<string, unknown>)
        : {};

  if (input.prompt !== undefined) existingConfig.prompt = input.prompt;
  if (input.welcomeMessage !== undefined) existingConfig.welcome_message = input.welcomeMessage;
  if (input.widgetPosition !== undefined) existingConfig.widget_position = input.widgetPosition;
  if (input.accentColor !== undefined) existingConfig.accent_color = input.accentColor;
  if (input.isEnabled !== undefined) existingConfig.is_enabled = input.isEnabled;
  if (input.isPrimary !== undefined) existingConfig.is_primary = input.isPrimary;

  await updateAgentMapping(restaurantId, localId, {
    name: input.name,
    voiceId: input.voiceId,
    config: existingConfig,
  });

  await updateCherryVoiceSettings(restaurantId, {
    agentId: localId,
    inworldVoiceId: input.voiceId ?? undefined,
    greeting: input.welcomeMessage,
    widgetPosition: input.widgetPosition,
    accentColor: input.accentColor,
    isEnabled: input.isEnabled,
  });

  if (input.prompt !== undefined) {
    await updateAgentContext(restaurantId, { generatedPrompt: input.prompt });
  }

  return { config: existingConfig };
}

export async function getNativeAgentWidgetInfo(restaurantId: number) {
  const settings = await getCherryVoiceSettingsByRestaurant(restaurantId);
  if (!settings) return null;
  return settings;
}
