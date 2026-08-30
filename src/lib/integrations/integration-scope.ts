import "server-only";

type IntegrationHeaders = Array<{ key?: string; value?: string }> | undefined;

/** Extract the tenant API key baked into an Omnidim custom API integration. */
export function extractIntegrationApiKey(headers: IntegrationHeaders): string | null {
  if (!headers?.length) return null;
  for (const row of headers) {
    const key = row.key?.trim().toLowerCase();
    if (key === "x-restaurant-key" && row.value?.trim()) return row.value.trim();
  }
  for (const row of headers) {
    const key = row.key?.trim().toLowerCase();
    if (key === "authorization" && row.value?.trim()) {
      const match = row.value.trim().match(/^Bearer\s+(.+)$/i);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return null;
}

/** True when integration headers carry the expected per-restaurant API key. */
export function integrationApiKeyMatches(
  headers: IntegrationHeaders,
  expectedApiKey: string,
): boolean {
  const actual = extractIntegrationApiKey(headers);
  return actual != null && actual === expectedApiKey;
}

/** Stable, unique Omnidim integration name per restaurant + tool (avoids org-wide collisions). */
export function buildScopedIntegrationName(toolName: string, restaurantId: number): string {
  return `${toolName}_r${restaurantId}`;
}

/** Fallback names when the primary scoped name already exists at org level. */
export function buildIntegrationNameCandidates(
  toolName: string,
  restaurantId: number,
): string[] {
  const primary = buildScopedIntegrationName(toolName, restaurantId);
  return [primary, `${primary}_v2`, `${primary}_v3`];
}
