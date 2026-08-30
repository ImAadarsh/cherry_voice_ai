import "server-only";
import OmniDimension from "@omnidim-ai/sdk";
import { getOmnidimApiKey } from "./platform-config";

/**
 * Server-side OmniDimension client. Loads API key from platform_settings first,
 * then falls back to OMNIDIM_API_KEY in .env.
 * Do NOT import this into client components — it carries the API key.
 */
declare global {
  // eslint-disable-next-line no-var
  var __omnidim: OmniDimension | undefined;
  // eslint-disable-next-line no-var
  var __omnidimKey: string | undefined;
}

let cachedClient: OmniDimension | null = null;
let cachedKey: string | null = null;

/** Get (or create) the Omnidim SDK client with the resolved platform API key. */
export async function getOmnidim(): Promise<OmniDimension> {
  const apiKey = await getOmnidimApiKey();
  if (!apiKey) {
    throw new Error("OMNIDIM_API_KEY is not configured");
  }

  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new OmniDimension({ apiKey });
  cachedKey = apiKey;

  if (process.env.NODE_ENV !== "production") {
    global.__omnidim = cachedClient;
    global.__omnidimKey = apiKey;
  }

  return cachedClient;
}

/**
 * @deprecated Use getOmnidim() — sync singleton may use stale env-only key.
 * Kept temporarily for modules not yet migrated.
 */
export const omnidim: OmniDimension =
  global.__omnidim ?? new OmniDimension({ apiKey: process.env.OMNIDIM_API_KEY ?? "" });

/** List agents from Omnidim (thin wrapper for the dashboard). */
export async function listOmnidimAgents(pagesize = 50) {
  const client = await getOmnidim();
  return client.agents.list({ pagesize });
}

/** Dispatch an outbound call (e.g. to confirm an order or read a payment link). */
export async function dispatchCall(agentId: number | string, toNumber: string) {
  const client = await getOmnidim();
  return client.calls.dispatch({ agent_id: Number(agentId), to_number: toNumber });
}
