const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

/**
 * Normalize a phone value from voice agents: spoken digits ("nine three nine…"),
 * mixed text, or standard numeric formats → digits-only string (10–15 digits).
 * Returns the original trimmed string if no digits could be extracted.
 */
export function normalizePhoneInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  const spokenParts: string[] = [];
  for (const token of lower.split(/[\s,.\-–—]+/)) {
    const t = token.replace(/[^a-z0-9+]/g, "");
    if (!t) continue;
    if (DIGIT_WORDS[t] != null) {
      spokenParts.push(DIGIT_WORDS[t]);
    } else if (/^\d+$/.test(t)) {
      spokenParts.push(t);
    }
  }

  if (spokenParts.length >= 7) {
    return spokenParts.join("");
  }

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 ? digits : trimmed;
}
