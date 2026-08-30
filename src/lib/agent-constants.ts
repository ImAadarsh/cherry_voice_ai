export type VoiceAgentType = "native" | "platform";

export const AGENT_TYPE_LABELS: Record<VoiceAgentType, string> = {
  native: "Cherry Voice",
  platform: "Phone & Web",
};

export const AGENT_TYPE_DESCRIPTIONS: Record<VoiceAgentType, string> = {
  native:
    "Cherry Voice native agent — Deepgram STT, Gemini LLM, Inworld TTS. Embeds on your website with a floating call button.",
  platform:
    "Phone & web agent via the voice platform — inbound/outbound phone calls and browser web calls.",
};

export const CHERRY_VOICE_INTEGRATION_TOOLS = [
  { name: "get_menu", label: "Menu lookup", description: "Fetch menu categories and items with prices" },
  { name: "get_restaurant_info", label: "Restaurant info", description: "Hours, address, delivery area, policies" },
  { name: "lookup_customer", label: "Customer lookup", description: "Find returning customers by phone" },
  { name: "create_order", label: "Place orders", description: "Create pickup, delivery, or dine-in orders" },
  { name: "send_payment_link", label: "Payment links", description: "Send secure payment links for orders" },
  { name: "create_reservation", label: "Reservations", description: "Book table reservations" },
] as const;

export function isNativeAgentId(omnidimAgentId: string): boolean {
  return omnidimAgentId.startsWith("cv_native_");
}

export function isNativeAgentType(agentType?: string | null, omnidimAgentId?: string): boolean {
  if (agentType === "native") return true;
  if (agentType === "platform") return false;
  return omnidimAgentId ? isNativeAgentId(omnidimAgentId) : false;
}
