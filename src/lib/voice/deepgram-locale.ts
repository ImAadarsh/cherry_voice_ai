import "server-only";
export function getDeepgramEndpointing(locale?: string | null) {
  const loc = String(locale ?? "en").toLowerCase();
  const hi = loc.startsWith("hi") || loc.includes("hindi");
  return hi
    ? { language: "hi", endpointing: "600", utterance_end_ms: "1500" }
    : { language: "en-US", endpointing: "400", utterance_end_ms: "1000" };
}
export async function resolveRestaurantSttLocale(restaurantId: number): Promise<string> {
  const { getRestaurant, getSetting } = await import("@/lib/repositories/settings");
  const [r, loc] = await Promise.all([
    getRestaurant(restaurantId),
    getSetting<string>(restaurantId, "voice", "locale"),
  ]);
  if (loc?.trim()) return loc.trim();
  return String(r?.country ?? "").toUpperCase() === "IN" ? "hi" : "en-US";
}
