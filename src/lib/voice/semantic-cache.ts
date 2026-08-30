import "server-only";

export type SemanticCacheHit = {
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
};

const MENU_INTENT =
  /\b(menu|menus|what(?:'s| is| are) (?:popular|good|available|on the menu)|what do you (?:have|serve|offer)|show me (?:the )?menu|recommend something|what can i (?:get|order))\b/i;

const GREETING_INTENT =
  /^(?:hi|hello|hey|yo|good (?:morning|afternoon|evening)|namaste|howdy|hola)[!.?\s]*$/i;

/** Fast-path common intents without an LLM round-trip. */
export function matchSemanticCache(userText: string): SemanticCacheHit | null {
  const text = userText.trim();
  if (!text) return null;

  if (MENU_INTENT.test(text)) {
    return {
      text: "Sure — let me pull up the menu.",
      toolCalls: [{ name: "get_menu", args: {} }],
    };
  }

  if (GREETING_INTENT.test(text)) {
    return { text: "Hi there! What can I get started for you today?" };
  }

  return null;
}
