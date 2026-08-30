/** True when Omnidim cloud cannot reach this APP_BASE_URL (localhost / private LAN). */
export function isUnreachableFromCloud(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    const host = hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      return true;
    }
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    const m = host.match(/^172\.(\d+)\./);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
    return false;
  } catch {
    return true;
  }
}

export function buildIntegrationUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}
