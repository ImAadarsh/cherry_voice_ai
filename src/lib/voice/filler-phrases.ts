import "server-only";
import { getRestaurant } from "@/lib/repositories/settings";

type LocaleHint = "en" | "hi";

async function localeForRestaurant(restaurantId: number): Promise<LocaleHint> {
  const restaurant = await getRestaurant(restaurantId);
  const country = String(restaurant?.country ?? "").toUpperCase();
  const currency = String(restaurant?.currency ?? "").toUpperCase();
  if (country === "IN" || currency === "INR") return "hi";
  return "en";
}

const TOOL_FILLERS_EN: Record<string, string> = {
  get_menu: "One moment, let me check the menu for you.",
  get_restaurant_info: "Let me pull up our hours and location.",
  lookup_customer: "Let me look that up for you.",
  create_order: "One moment, I'll place that order for you.",
  update_order: "Let me update your order.",
  send_payment_link: "I'll send you a payment link right now.",
  create_reservation: "Let me book that reservation for you.",
};

const TOOL_FILLERS_HI: Record<string, string> = {
  get_menu: "एक पल रुकें, मैं मेन्यू देखता हूँ।",
  get_restaurant_info: "मैं हमारे समय और जगह की जानकारी देखता हूँ।",
  lookup_customer: "मैं आपकी जानकारी देखता हूँ।",
  create_order: "एक पल, मैं आपका ऑर्डर लगाता हूँ।",
  update_order: "मैं आपका ऑर्डर अपडेट करता हूँ।",
  send_payment_link: "मैं अभी पेमेंट लिंक भेजता हूँ।",
  create_reservation: "मैं आपकी रेज़र्वेशन बुक करता हूँ।",
};

const DEFAULT_FILLER_EN = "One moment, let me check that for you.";
const DEFAULT_FILLER_HI = "एक पल रुकें, मैं देखता हूँ।";

const SILENCE_PROMPT_EN = "Are you still there? I'm here whenever you're ready.";
const SILENCE_PROMPT_HI = "आप वहाँ हैं? मैं यहाँ हूँ, जब चाहें बोल सकते हैं।";

const TTS_FALLBACK_EN = "I'm having a little trouble with audio. Let me try again.";
const TTS_FALLBACK_HI = "ऑडियो में थोड़ी समस्या है, मैं फिर से कोशिश करता हूँ।";

export async function getToolFillerPhrase(
  restaurantId: number,
  toolNames: string[],
): Promise<string> {
  const locale = await localeForRestaurant(restaurantId);
  const map = locale === "hi" ? TOOL_FILLERS_HI : TOOL_FILLERS_EN;
  const defaultFiller = locale === "hi" ? DEFAULT_FILLER_HI : DEFAULT_FILLER_EN;

  for (const name of toolNames) {
    const phrase = map[name];
    if (phrase) return phrase;
  }
  return defaultFiller;
}

export async function getSilencePromptPhrase(restaurantId: number): Promise<string> {
  const locale = await localeForRestaurant(restaurantId);
  return locale === "hi" ? SILENCE_PROMPT_HI : SILENCE_PROMPT_EN;
}

export async function getTtsFallbackPhrase(restaurantId: number): Promise<string> {
  const locale = await localeForRestaurant(restaurantId);
  return locale === "hi" ? TTS_FALLBACK_HI : TTS_FALLBACK_EN;
}
