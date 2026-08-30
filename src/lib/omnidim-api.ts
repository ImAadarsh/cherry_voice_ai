import "server-only";
import { fail } from "./http";
import { env } from "./env";

const OMNIDIM_BASE = "https://backend.omnidim.io/api/v1";

/** Return 503 when Omnidim is not configured. */
export function requireOmnidimKey(): string | Response {
  if (!env.OMNIDIM_API_KEY) {
    return fail("OMNIDIM_API_KEY is not configured", 503);
  }
  return env.OMNIDIM_API_KEY;
}

/** Raw Omnidim HTTP for endpoints not yet in the typed SDK (e.g. simulations). */
export async function omnidimRawRequest<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const key = requireOmnidimKey();
  if (key instanceof Response) throw new Error("OMNIDIM_API_KEY is not configured");

  const url = new URL(OMNIDIM_BASE + path);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(json.error ?? json.message ?? `Omnidim request failed (${res.status})`);
  }
  return json;
}
