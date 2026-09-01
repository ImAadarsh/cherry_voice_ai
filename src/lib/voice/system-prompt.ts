import "server-only";
import { VOICE_INTEGRATION_TOOLS_PROMPT, VOICE_STYLE_PROMPT } from "@/lib/integration-tools";
import { getAgentContext } from "@/lib/repositories/onboarding";
import { getRestaurant } from "@/lib/repositories/settings";
import { detectLanguageMix, languageMixPrompt } from "./language-detect";
import { getFestivalPromptSnippet } from "./festival-prompts";
import {
  getBranchRoutingPrompt,
  getEmotionalTonePrompt,
  getTableNumberPrompt,
  getTextOnlyModePrompt,
} from "./p2-prompts";
import { getPersonalityPrompt } from "./personality";
import type { VoiceSessionRecord } from "./session-store";
import { getHoursStatus } from "./restaurant-context";

const MAX_VOICE_PROMPT_CHARS = 3800;

function trimGeneratedPromptForVoice(prompt: string): string {
  return prompt
    .replace(/Menu overview:[\s\S]*?(?=\n\n[A-Z]|\n\n$|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);
}

export async function buildVoiceSystemPrompt(session: VoiceSessionRecord, userText?: string): Promise<string> {
  const [restaurant, context, hours] = await Promise.all([
    getRestaurant(session.restaurantId),
    getAgentContext(session.restaurantId),
    getHoursStatus(session.restaurantId),
  ]);
  session.hoursStatus = hours;

  const currency = restaurant?.currency ?? "USD";
  const parts = [
    `You are the voice assistant for ${restaurant?.name ?? "this restaurant"}. All prices are in ${currency}.`,
    VOICE_STYLE_PROMPT,
    VOICE_INTEGRATION_TOOLS_PROMPT,
    getPersonalityPrompt(session.personalityPreset),
  ];
  if (session.agentCustomPrompt?.trim()) {
    parts.push(`## Agent instructions\n${session.agentCustomPrompt.trim().slice(0, 1200)}`);
  }
  const fest = getFestivalPromptSnippet();
  if (fest) parts.push(fest);
  if (session.branchLabel) parts.push(getBranchRoutingPrompt(session.branchLabel));
  parts.push(`## Kitchen\n${hours.message}`);
  parts.push(getTableNumberPrompt());
  if (session.orderId) parts.push(`## Active order\nOrder ${session.orderId} — use update_order only.`);
  if (context?.generated_prompt) {
    const trimmed = trimGeneratedPromptForVoice(context.generated_prompt);
    if (trimmed) parts.push(trimmed);
  }
  const mix = detectLanguageMix(userText ?? session.lastUserText);
  session.detectedLanguage = mix;
  const lp = languageMixPrompt(mix, restaurant?.country ?? undefined);
  if (lp) parts.push(lp);
  parts.push(getEmotionalTonePrompt(session.lowConfidenceUtterance));
  if (session.textOnlyMode) parts.push(getTextOnlyModePrompt());
  const joined = parts.join("\n\n");
  return joined.length > MAX_VOICE_PROMPT_CHARS ? joined.slice(0, MAX_VOICE_PROMPT_CHARS) : joined;
}

export function updateConversationMemoryFromUser(session: VoiceSessionRecord, text: string): void {
  session.lastUserText = text;
  const m = text.match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
  if (m) {
    session.conversationMemory.phone = m[0].trim();
    session.callerPhone = session.conversationMemory.phone;
  }
}

export function updateConversationMemoryFromTool(
  session: VoiceSessionRecord,
  tool: string,
  args: Record<string, unknown>,
  result: { ok: boolean },
): void {
  if (tool === "create_order" && result.ok) session.upsellSuggested = true;
  if ((tool === "create_order" || tool === "update_order") && Array.isArray(args.items) && args.items.length) {
    session.orderItemsSet = true;
  }
  if (typeof args.phone === "string") {
    session.conversationMemory.phone = args.phone;
    session.callerPhone = args.phone;
  }
}
