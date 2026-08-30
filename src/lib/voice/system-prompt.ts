import "server-only";
import { INTEGRATION_TOOLS_PROMPT, VOICE_STYLE_PROMPT } from "@/lib/integration-tools";
import { getAgentContext } from "@/lib/repositories/onboarding";
import { listCategories } from "@/lib/repositories/menu";
import { getRestaurant } from "@/lib/repositories/settings";
import { detectLanguageMix, languageMixPrompt } from "./language-detect";
import { getFestivalPromptSnippet } from "./festival-prompts";
import {
  getBranchRoutingPrompt,
  getComboBuilderPrompt,
  getEmotionalTonePrompt,
  getProactiveUpsellPrompt,
  getTableNumberPrompt,
  getTextOnlyModePrompt,
} from "./p2-prompts";
import { getPersonalityPrompt } from "./personality";
import type { VoiceSessionRecord } from "./session-store";
import { getDailySpecials, getHoursStatus } from "./restaurant-context";

export async function buildVoiceSystemPrompt(session: VoiceSessionRecord, userText?: string): Promise<string> {
  const [restaurant, context, hours, specials, categories] = await Promise.all([
    getRestaurant(session.restaurantId),
    getAgentContext(session.restaurantId),
    getHoursStatus(session.restaurantId),
    getDailySpecials(session.restaurantId),
    listCategories(session.restaurantId),
  ]);
  session.hoursStatus = hours;
  const comboCats = categories
    .filter((c) => Boolean((c as Record<string, unknown>).is_combo))
    .map((c) => String((c as Record<string, unknown>).name ?? ""));

  const parts = [
    `You are the voice assistant for ${restaurant?.name ?? "this restaurant"}.`,
    VOICE_STYLE_PROMPT,
    INTEGRATION_TOOLS_PROMPT,
    getPersonalityPrompt(session.personalityPreset),
  ];
  const fest = getFestivalPromptSnippet();
  if (fest) parts.push(fest);
  if (session.branchLabel) parts.push(getBranchRoutingPrompt(session.branchLabel));
  parts.push(`## Kitchen\n${hours.message}`);
  if (specials.length) parts.push(`## Specials\n${specials.join("; ")}`);
  const combo = getComboBuilderPrompt(comboCats);
  if (combo) parts.push(combo);
  parts.push(getTableNumberPrompt());
  if (session.orderItemsSet && !session.upsellSuggested && !session.orderId) parts.push(getProactiveUpsellPrompt());
  if (session.orderId) parts.push(`## Active order\nOrder ${session.orderId} — use update_order only.`);
  if (context?.generated_prompt) parts.push(context.generated_prompt);
  const mix = detectLanguageMix(userText ?? session.lastUserText);
  session.detectedLanguage = mix;
  const lp = languageMixPrompt(mix, restaurant?.country ?? undefined);
  if (lp) parts.push(lp);
  parts.push(getEmotionalTonePrompt(session.lowConfidenceUtterance));
  if (session.textOnlyMode) parts.push(getTextOnlyModePrompt());
  return parts.join("\n\n");
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
