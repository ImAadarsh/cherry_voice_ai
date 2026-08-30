export type LanguageMix = "en" | "hi" | "mixed";

const DEVANAGARI = /[\u0900-\u097F]/;

export function detectLanguageMix(text: string): LanguageMix {
  const t = text.trim();
  if (!t) return "en";
  const hasHindi = DEVANAGARI.test(t);
  const latinWords = t.replace(/[^\sA-Za-z']/g, " ").split(/\s+/).filter(Boolean).length;
  if (hasHindi && latinWords > 2) return "mixed";
  if (hasHindi) return "hi";
  return "en";
}

export function languageMixPrompt(mix: LanguageMix, country?: string): string {
  if (String(country ?? "").toUpperCase() !== "IN" && mix === "en") return "";
  if (mix === "hi") return "## Language\nRespond in Hindi with short spoken sentences.";
  if (mix === "mixed") return "## Language\nMirror Hinglish naturally — mix Hindi and English like the caller.";
  return "## Language\nClear English; match Hindi or Hinglish if the customer switches.";
}
