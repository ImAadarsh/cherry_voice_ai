export type PersonalityPreset = "warm" | "professional" | "casual";

export const PERSONALITY_PRESETS: PersonalityPreset[] = ["warm", "professional", "casual"];

export const PERSONALITY_LABELS: Record<PersonalityPreset, string> = {
  warm: "Warm & friendly",
  professional: "Professional",
  casual: "Casual",
};

const PROMPTS: Record<PersonalityPreset, string> = {
  warm: `## Personality: Warm & friendly
- Sound welcoming, patient, and upbeat — like a favorite local server.
- Use the caller's name when you know it.
- Brief empathy when something goes wrong.`,
  professional: `## Personality: Professional
- Polite, concise, and confident — no slang.
- Focus on accuracy: repeat key details (items, times, totals).
- Stay calm under pressure.`,
  casual: `## Personality: Casual
- Relaxed and conversational — short sentences, natural rhythm.
- Light humor is OK; never be flippant about orders or allergies.`,
};

export function normalizePersonalityPreset(value: unknown): PersonalityPreset {
  const s = String(value ?? "warm").toLowerCase();
  if (s === "professional" || s === "casual") return s;
  return "warm";
}

export function getPersonalityPrompt(preset: PersonalityPreset): string {
  return PROMPTS[preset];
}
