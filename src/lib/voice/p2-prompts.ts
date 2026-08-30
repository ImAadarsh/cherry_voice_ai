import "server-only";
export const getProactiveUpsellPrompt = () =>
  "## Soft upsell\nAfter main items are chosen, suggest one complementary item using menu tags (e.g. drinks with mains, dessert after savory). One suggestion only; accept a polite no.";
export const getEmotionalTonePrompt = (low: boolean) => low
  ? "## Low STT confidence\nAsk calmly to repeat; do not guess."
  : "## Emotional tone\nSlow down if customer sounds confused.";
export const getComboBuilderPrompt = (cats: string[]) => cats.length
  ? `## Combos\nBuild step-by-step for: ${cats.join(", ")}.`
  : "";
export const getTableNumberPrompt = () => "## Dine-in\nCapture table_number (1-999) for dine_in orders.";
export const getTextOnlyModePrompt = () => "## Text-only\nCustomer sees transcript prominently.";
export const getBranchRoutingPrompt = (b: string) => `## Branch\nServing branch: ${b}.`;
