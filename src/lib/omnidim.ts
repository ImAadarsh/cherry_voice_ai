import "server-only";
import OmniDimension from "@omnidim-ai/sdk";
import { env } from "./env";

/**
 * Server-side OmniDimension client. Singleton across hot reloads in dev.
 * Do NOT import this into client components — it carries the API key.
 */
declare global {
  // eslint-disable-next-line no-var
  var __omnidim: OmniDimension | undefined;
}

export const omnidim: OmniDimension =
  global.__omnidim ?? new OmniDimension({ apiKey: env.OMNIDIM_API_KEY });

if (env.NODE_ENV !== "production") {
  global.__omnidim = omnidim;
}

/** List agents from Omnidim (thin wrapper for the dashboard). */
export async function listOmnidimAgents(pagesize = 50) {
  return omnidim.agents.list({ pagesize });
}

/** Dispatch an outbound call (e.g. to confirm an order or read a payment link). */
export async function dispatchCall(agentId: number | string, toNumber: string) {
  return omnidim.calls.dispatch({ agent_id: Number(agentId), to_number: toNumber });
}
