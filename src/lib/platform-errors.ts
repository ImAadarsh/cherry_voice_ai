/** Strip vendor names from errors shown to restaurant users. */
export function sanitizePlatformError(message: string): string {
  return message
    .replace(/\bOmnidim\b/gi, "Voice AI platform")
    .replace(/\bOmniDimension\b/gi, "Voice AI platform");
}
