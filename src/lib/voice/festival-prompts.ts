export function getFestivalPromptSnippet(now = new Date()): string {
  const m = now.getMonth() + 1, d = now.getDate();
  if ((m === 10 && d >= 20) || (m === 11 && d <= 5)) return "## Seasonal\nWish a happy Diwali season.";
  if (m === 12 && d >= 15) return "## Seasonal\nHoliday greetings welcome.";
  return "";
}
